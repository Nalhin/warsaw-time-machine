"""Warp a real modern photo onto the exact framing of an old one, for a pixel-aligned before/after.

    uv run python align.py old.jpg today.jpg                      # -> today_aligned.jpg (+ old_crop.jpg)
    uv run python align.py old.jpg today.jpg --debug check.jpg    # also save matches + 50/50 overlay
    uv run python align.py old.jpg today.jpg --points pts.json    # manual control points instead of AI matching

Nothing is generated or invented. The script finds the same building features in both photos with LoFTR
(a learned feature matcher that copes with 90 years of change in lighting, film and paint), fits a
homography (a perspective transform), and reprojects the modern photo into the old camera's frame. Both
images are then cropped to the area that both cover.

A homography is exact for flat scenes (one facade) or when both photos were taken from the same spot.
Results are best when the modern photo was taken near where the old photographer stood. Large
differences in position cause parallax, which no transform can remove: re-take the photo instead.

pts.json for --points (pixel coordinates in the original files, at least 4 pairs, ideally 6+ spread out):
    {"old": [[x, y], ...], "today": [[x, y], ...]}
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

MATCH_SIDE = 840
MIN_INLIERS = 30
MIN_INLIER_RATIO = 0.5
MIN_SHARED_AREA = 0.4


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load(path: Path) -> np.ndarray:
    return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))


def to_match_tensor(rgb: np.ndarray):
    import torch

    h, w = rgb.shape[:2]
    k = MATCH_SIDE / max(h, w)
    nw, nh = max(8, round(w * k / 8) * 8), max(8, round(h * k / 8) * 8)
    grey = cv2.cvtColor(cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    grey = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(grey)
    t = torch.from_numpy(grey).float().div(255)[None, None]
    return t, np.array([w / nw, h / nh])


def ai_matches(old: np.ndarray, today: np.ndarray, min_conf: float) -> tuple[np.ndarray, np.ndarray]:
    import torch
    from kornia.feature import LoFTR

    matcher = LoFTR(pretrained="outdoor").eval()
    t0, s0 = to_match_tensor(old)
    t1, s1 = to_match_tensor(today)
    with torch.inference_mode():
        out = matcher({"image0": t0, "image1": t1})
    keep = out["confidence"].numpy() >= min_conf
    p_old = out["keypoints0"].numpy()[keep] * s0
    p_today = out["keypoints1"].numpy()[keep] * s1
    log(f"LoFTR: {keep.sum()} matches with confidence ≥ {min_conf}")
    return p_old, p_today


def check_homography(H: np.ndarray | None, w: int, h: int) -> str | None:
    if H is None:
        return "no transform found"
    corners = np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2)
    warped = cv2.perspectiveTransform(corners, H).reshape(-1, 2)
    if not cv2.isContourConvex(warped.astype(np.float32).reshape(-1, 1, 2)):
        return "transform folds the image"
    scale = cv2.contourArea(warped.astype(np.float32)) / (w * h)
    if not 0.05 < scale < 20:
        return f"implausible scale change ({scale:.2f}x area)"
    return None


def largest_valid_rect(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    step = max(1, round(max(mask.shape) * 0.005))
    while x1 - x0 > 20 and y1 - y0 > 20:
        sub = mask[y0:y1, x0:x1]
        if sub.all():
            break
        bad = {
            "l": (~sub[:, :step]).sum(),
            "r": (~sub[:, -step:]).sum(),
            "t": (~sub[:step, :]).sum(),
            "b": (~sub[-step:, :]).sum(),
        }
        side = max(bad, key=bad.get)
        if side == "l":
            x0 += step
        elif side == "r":
            x1 -= step
        elif side == "t":
            y0 += step
        else:
            y1 -= step
    return int(x0), int(y0), int(x1), int(y1)


def save(rgb: np.ndarray, path: Path, quality: int = 90) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb).save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    log(f"-> {path} ({rgb.shape[1]}x{rgb.shape[0]})")


def debug_image(old, today, p_old, p_today, inliers, aligned_full, path: Path) -> None:
    h = 600
    a = cv2.resize(old, (round(old.shape[1] * h / old.shape[0]), h))
    b = cv2.resize(today, (round(today.shape[1] * h / today.shape[0]), h))
    top = np.concatenate([a, b], axis=1).copy()
    sa, sb = h / old.shape[0], h / today.shape[0]
    rng = np.random.default_rng(0)
    idx = np.flatnonzero(inliers)
    for i in rng.choice(idx, size=min(150, len(idx)), replace=False):
        c = tuple(int(v) for v in rng.integers(80, 255, 3))
        pa = (int(p_old[i][0] * sa), int(p_old[i][1] * sa))
        pb = (int(p_today[i][0] * sb) + a.shape[1], int(p_today[i][1] * sb))
        cv2.line(top, pa, pb, c, 1, cv2.LINE_AA)
    old_grey = cv2.cvtColor(cv2.cvtColor(old, cv2.COLOR_RGB2GRAY), cv2.COLOR_GRAY2RGB)
    blend = cv2.addWeighted(old_grey, 0.5, aligned_full, 0.5, 0)
    blend = cv2.resize(blend, (top.shape[1], round(blend.shape[0] * top.shape[1] / blend.shape[1])))
    save(np.concatenate([top, blend], axis=0), path, quality=85)


def align_pair(
    old: np.ndarray,
    today: np.ndarray,
    *,
    points: dict | None = None,
    min_conf: float = 0.5,
    crop: bool = True,
    debug: Path | None = None,
) -> tuple[np.ndarray, np.ndarray, dict]:
    h, w = old.shape[:2]
    if points:
        p_old, p_today = np.float32(points["old"]), np.float32(points["today"])
        if len(p_old) != len(p_today) or len(p_old) < 4:
            raise AlignError("manual points need the same number (≥ 4) of 'old' and 'today' points")
        H, inl = cv2.findHomography(p_today, p_old, 0 if len(p_old) == 4 else cv2.RANSAC, 8.0)
        min_inliers = 4
    else:
        p_old, p_today = ai_matches(old, today, min_conf)
        if len(p_old) < MIN_INLIERS:
            raise AlignError(f"only {len(p_old)} matches: the photos are too different")
        thresh = 0.004 * max(w, h)
        H, inl = cv2.findHomography(p_today, p_old, cv2.USAC_MAGSAC, thresh, maxIters=20000, confidence=0.9999)
        min_inliers = MIN_INLIERS

    inliers = inl.ravel().astype(bool) if inl is not None else np.zeros(len(p_old), bool)
    log(f"Homography inliers: {inliers.sum()} / {len(p_old)}")
    if inliers.sum() < min_inliers:
        raise AlignError("not enough consistent matches for a reliable alignment")
    ratio = float(inliers.mean())
    if not points and ratio < MIN_INLIER_RATIO:
        raise AlignError(
            f"only {ratio:.0%} of matches agree (need {MIN_INLIER_RATIO:.0%}); the photos are probably taken "
            "from too different a position, or the matcher locked onto repeating windows"
        )
    if reason := check_homography(H, today.shape[1], today.shape[0]):
        raise AlignError(f"alignment rejected: {reason}")

    aligned = cv2.warpPerspective(today, H, (w, h), flags=cv2.INTER_LANCZOS4, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.full(today.shape[:2], 255, np.uint8), H, (w, h), flags=cv2.INTER_NEAREST) > 0
    proj = cv2.perspectiveTransform(p_today[inliers].reshape(-1, 1, 2).astype(np.float64), H).reshape(-1, 2)
    err = float(np.median(np.linalg.norm(proj - p_old[inliers], axis=1)))
    log(f"Median reprojection error: {err:.1f} px; area covered: {mask.mean() * 100:.0f}%")
    if debug:
        debug_image(old, today, p_old, p_today, inliers, aligned, debug)

    stats = {"inliers": int(inliers.sum()), "inlier_ratio": round(float(ratio), 2), "median_error_px": round(err, 2), "crop": [0, 0, w, h]}
    if not crop:
        return aligned, old, stats
    x0, y0, x1, y1 = largest_valid_rect(mask)
    shared = (x1 - x0) * (y1 - y0) / (w * h)
    log(f"Shared area: {x1 - x0}x{y1 - y0} ({shared * 100:.0f}% of the old frame)")
    if shared < MIN_SHARED_AREA:
        raise AlignError(f"the photos only share {shared:.0%} of the old frame")
    stats["crop"] = [x0, y0, x1, y1]
    return aligned[y0:y1, x0:x1], old[y0:y1, x0:x1], stats


class AlignError(Exception):
    pass


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("old", type=Path)
    ap.add_argument("today", type=Path)
    ap.add_argument("-o", "--output", type=Path, help="aligned modern photo (default: <today>_aligned.jpg)")
    ap.add_argument("--old-output", type=Path, help="old photo cropped to the shared area (default: <old>_crop.jpg)")
    ap.add_argument("--points", type=Path, help="manual control points (JSON) instead of AI matching")
    ap.add_argument("--min-conf", type=float, default=0.5, help="LoFTR match confidence threshold")
    ap.add_argument("--no-crop", action="store_true", help="keep the old photo's full frame (uncovered areas black)")
    ap.add_argument("--debug", type=Path, help="save a match / overlay visualisation")
    args = ap.parse_args()

    try:
        aligned, old_crop, stats = align_pair(
            load(args.old),
            load(args.today),
            points=json.loads(args.points.read_text()) if args.points else None,
            min_conf=args.min_conf,
            crop=not args.no_crop,
            debug=args.debug,
        )
    except AlignError as e:
        sys.exit(f"{e}. Try --points, or a modern photo taken closer to the old viewpoint.")

    save(aligned, args.output or args.today.with_name(f"{args.today.stem}_aligned.jpg"))
    if not args.no_crop:
        save(old_crop, args.old_output or args.old.with_name(f"{args.old.stem}_crop.jpg"))
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
