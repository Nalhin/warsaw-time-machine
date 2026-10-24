"""Build the site's photos and spots.json from pipeline/sources/.

    uv run python prepare_spots.py              # all spots in sources/sources.json
    uv run python prepare_spots.py plac-zamkowy # just one
    uv run python prepare_spots.py --force      # redo the AI restoration even if it exists

For each spot in sources/sources.json (see README for the format) it writes:
    public/img/<id>_old.jpg     original archival photo, resized for the web
    public/img/<id>_ai.jpg      restore.py output (Real-ESRGAN + DDColor, labelled "AI")
    public/img/<id>_today.jpg   today's photo, resized for the web
    public/img/og/<id>.jpg      1200x630 link preview (old | today)
With "align": true (or {"points": "<file>.json"}) in the source entry, the today photo is also warped
onto the old photo's framing (align.py) for a pixel-matched slider:
    public/img/<id>_cmp_{old,ai,today}.jpg
and updates the entry in src/data/spots.json, leaving entries that aren't in sources.json alone.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps

import og
from align import AlignError, align_pair, load as load_rgb
from restore import Colorizer, Upscaler, restore

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
PUBLIC = HERE.parent / "public"
IMG = PUBLIC / "img"
SPOTS_JSON = HERE.parent / "src" / "data" / "spots.json"
WEB_SIDE = 1600


def web_copy(src: Path, dst: Path, quality: int = 82) -> None:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((WEB_SIDE, WEB_SIDE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)


def credit(c: dict) -> dict:
    return {
        "author": c.get("author") or "unknown",
        "date": c.get("date") or None,
        "licence": c.get("licence") or "",
        "licenceUrl": c.get("licenceUrl") or None,
        "source": "Wikimedia Commons" if "commons.wikimedia.org" in (c.get("page") or "") else (c.get("source") or "source"),
        "sourceUrl": c.get("page") or c.get("sourceUrl") or None,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="only these spot ids")
    ap.add_argument("--force", action="store_true", help="re-run the AI restoration")
    ap.add_argument("--no-ai", action="store_true", help="skip the AI restoration")
    args = ap.parse_args()

    sources = json.loads((SOURCES / "sources.json").read_text())
    if args.ids:
        sources = [s for s in sources if s["id"] in args.ids]
    spots = json.loads(SPOTS_JSON.read_text()) if SPOTS_JSON.exists() else []
    by_id = {s["id"]: s for s in spots}

    upscaler = colorizer = None
    for src in sources:
        sid = src["id"]
        old_src, today_src = SOURCES / src["old"]["file"], SOURCES / src["today"]["file"]
        print(f"== {sid}")
        web_copy(old_src, IMG / f"{sid}_old.jpg")
        web_copy(today_src, IMG / f"{sid}_today.jpg", quality=80)

        ai = IMG / f"{sid}_ai.jpg"
        if not args.no_ai and (args.force or not ai.exists()):
            if upscaler is None:
                upscaler, colorizer = Upscaler(), Colorizer()
            restore(
                old_src, ai, upscaler=upscaler, colorizer=colorizer, max_input=1000,
                max_output=WEB_SIDE, saturation=1.2, label=True, quality=84,
            )

        compare = None
        if src.get("align"):
            opts = src["align"] if isinstance(src["align"], dict) else {}
            points = json.loads((SOURCES / opts["points"]).read_text()) if opts.get("points") else None
            try:
                aligned, old_crop, stats = align_pair(load_rgb(old_src), load_rgb(today_src), points=points)
            except AlignError as e:
                print(f"  ! alignment failed ({e}); using the unaligned photos")
            else:
                print(f"  aligned: {stats}")
                cmp_old, cmp_today, cmp_ai = (IMG / f"{sid}_cmp_{k}.jpg" for k in ("old", "today", "ai"))
                for rgb, path, q in ((old_crop, cmp_old, 82), (aligned, cmp_today, 80)):
                    im = Image.fromarray(rgb)
                    im.thumbnail((WEB_SIDE, WEB_SIDE), Image.LANCZOS)
                    im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
                if not args.no_ai and (args.force or not cmp_ai.exists()):
                    if upscaler is None:
                        upscaler, colorizer = Upscaler(), Colorizer()
                    restore(
                        cmp_old, cmp_ai, upscaler=upscaler, colorizer=colorizer, max_input=1000,
                        max_output=WEB_SIDE, saturation=1.2, label=True, quality=84,
                    )
                compare = {
                    "old": f"/img/{cmp_old.name}",
                    "today": f"/img/{cmp_today.name}",
                    "restored": f"/img/{cmp_ai.name}" if cmp_ai.exists() else None,
                }
                old_src_og, today_src_og = cmp_old, cmp_today

        old_year = src.get("oldYear") or "".join(ch for ch in (src["old"].get("date") or "")[:4] if ch.isdigit()) or None
        og.spot_card(
            old_src_og if compare else old_src,
            today_src_og if compare else today_src,
            src["name"], IMG / "og" / f"{sid}.jpg", old_label=old_year or "Pre-war")

        entry = by_id.get(sid, {})
        entry.update(
            {
                "id": sid,
                "name": src["name"],
                "lat": src["lat"],
                "lng": src["lng"],
                "heading": src.get("heading"),
                "description": src.get("description"),
                "oldYear": old_year,
                "old": f"/img/{sid}_old.jpg",
                "restored": f"/img/{sid}_ai.jpg" if ai.exists() else None,
                "today": f"/img/{sid}_today.jpg",
                "og": f"/img/og/{sid}.jpg",
                "compare": compare,
                "credits": {"old": credit(src["old"]), "today": credit(src["today"])},
            }
        )
        if sid not in by_id:
            spots.append(entry)
            by_id[sid] = entry

    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items() if v is not None}
        return o

    SPOTS_JSON.write_text(json.dumps([clean(s) for s in spots], ensure_ascii=False, indent=2) + "\n")
    print(f"-> {SPOTS_JSON} ({len(spots)} spots)")


if __name__ == "__main__":
    main()
