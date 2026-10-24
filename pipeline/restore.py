"""Restore a real archival photo: Real-ESRGAN x2 upscale, then DDColor colourization.

    uv run python restore.py input.jpg                     # -> input_ai.jpg
    uv run python restore.py a.jpg b.jpg --out-dir out/    # batch
    uv run python restore.py input.jpg -o out.jpg --no-upscale --saturation 1.3

Colour is predicted on a 512x512 copy, then only the Lab a/b channels are scaled up and
placed onto the full-resolution L (brightness) channel, so every detail comes from the
original photo. The result is labelled "AI" in the corner and in the JPEG metadata, because
the colours are a guess.

This script only restores existing photos. It must never be used to invent historical scenes.
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
ESRGAN_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
ESRGAN_PATH = MODELS / "RealESRGAN_x2plus.pth"
DDCOLOR_PATH = MODELS / "ddcolor_modelscope_512.onnx"
DDCOLOR_SIZE = 512

LABEL_TEXT = "AI-restored · colours are a guess"
LABEL_META = "AI-restored (Real-ESRGAN x2 + DDColor). Colours are a guess, not historical fact."

FONT_CANDIDATES = [
    HERE / "fonts" / "Inter-SemiBold.ttf",
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"),
    Path("C:/Windows/Fonts/arialbd.ttf"),
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)




def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"Downloading {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def pick_device(name: str):
    import torch

    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class Upscaler:

    def __init__(self, device: str = "auto", tile: int = 384, overlap: int = 24):
        import torch
        from spandrel import ImageModelDescriptor, ModelLoader

        if not ESRGAN_PATH.exists():
            download(ESRGAN_URL, ESRGAN_PATH)
        self.torch = torch
        self.device = pick_device(device)
        model = ModelLoader().load_from_file(ESRGAN_PATH)
        assert isinstance(model, ImageModelDescriptor)
        self.model = model.to(self.device).eval()
        self.scale = model.scale
        self.tile = tile
        self.overlap = overlap

    def __call__(self, rgb: np.ndarray) -> np.ndarray:
        torch = self.torch
        s, t, o = self.scale, self.tile, self.overlap
        h, w = rgb.shape[:2]
        src = torch.from_numpy(rgb).permute(2, 0, 1).float().div(255).unsqueeze(0)
        out = torch.zeros(1, 3, h * s, w * s)
        with torch.inference_mode():
            for y in range(0, h, t):
                for x in range(0, w, t):
                    y0, x0 = max(y - o, 0), max(x - o, 0)
                    y1, x1 = min(y + t + o, h), min(x + t + o, w)
                    res = self.model(src[:, :, y0:y1, x0:x1].to(self.device)).float().cpu()
                    ty, tx = (y - y0) * s, (x - x0) * s
                    th, tw = (min(y + t, h) - y) * s, (min(x + t, w) - x) * s
                    out[:, :, y * s : y * s + th, x * s : x * s + tw] = res[:, :, ty : ty + th, tx : tx + tw]
        return (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)


class Colorizer:

    def __init__(self, model_path: Path = DDCOLOR_PATH):
        import onnxruntime as ort

        if not model_path.exists():
            sys.exit(
                f"Missing {model_path}.\nExport it once with:  uv run --extra export python export_ddcolor.py"
            )
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = ort.InferenceSession(str(model_path), opts, providers=["CPUExecutionProvider"])
        self.input_name = self.sess.get_inputs()[0].name

    def __call__(self, rgb: np.ndarray, saturation: float = 1.2) -> np.ndarray:
        h, w = rgb.shape[:2]
        img = rgb.astype(np.float32) / 255.0
        full_l = cv2.cvtColor(img, cv2.COLOR_RGB2Lab)[:, :, :1]

        small = cv2.resize(img, (DDCOLOR_SIZE, DDCOLOR_SIZE), interpolation=cv2.INTER_AREA)
        small_l = cv2.cvtColor(small, cv2.COLOR_RGB2Lab)[:, :, :1]
        grey = cv2.cvtColor(np.concatenate([small_l, np.zeros_like(small_l), np.zeros_like(small_l)], -1), cv2.COLOR_Lab2RGB)
        ab = self.sess.run(None, {self.input_name: grey.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]

        ab = cv2.resize(ab.transpose(1, 2, 0), (w, h), interpolation=cv2.INTER_CUBIC) * saturation
        lab = np.concatenate([full_l, ab], -1).astype(np.float32)
        out = cv2.cvtColor(lab, cv2.COLOR_Lab2RGB)
        return (out.clip(0, 1) * 255).round().astype(np.uint8)




def load_rgb(path: Path) -> np.ndarray:
    im = ImageOps.exif_transpose(Image.open(path))
    return np.asarray(im.convert("L").convert("RGB"))


def fit(rgb: np.ndarray, max_side: int) -> np.ndarray:
    h, w = rgb.shape[:2]
    if max(h, w) <= max_side:
        return rgb
    k = max_side / max(h, w)
    return cv2.resize(rgb, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)


def load_font(size: int) -> ImageFont.ImageFont:
    for p in FONT_CANDIDATES:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def add_label(im: Image.Image, text: str = LABEL_TEXT) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    size = max(12, round(min(w, h) * 0.022))
    font = load_font(size)
    pad = round(size * 0.55)
    margin = round(size * 0.9)
    x0, y0, x1, y1 = ImageDraw.Draw(im).textbbox((0, 0), text, font=font)
    bw, bh = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    bx, by = margin, h - margin - bh
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=round(bh / 2.6), fill=(12, 12, 14, 170))
    d.text((bx + pad - x0, by + pad - y0), text, font=font, fill=(255, 255, 255, 235))
    return Image.alpha_composite(im, overlay).convert("RGB")


def save_jpeg(im: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    exif = Image.Exif()
    exif[0x010E] = LABEL_META
    exif[0x0131] = "warszawa-1935-1945-dzis/restore.py"
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True, exif=exif.tobytes())




def restore(
    path: Path,
    out: Path,
    *,
    upscaler: Upscaler | None,
    colorizer: Colorizer,
    max_input: int,
    max_output: int,
    saturation: float,
    label: bool,
    quality: int,
) -> None:
    t0 = time.time()
    rgb = fit(load_rgb(path), max_input)
    log(f"{path.name}: {rgb.shape[1]}x{rgb.shape[0]}")
    if upscaler:
        rgb = upscaler(rgb)
        log(f"  upscaled x{upscaler.scale} -> {rgb.shape[1]}x{rgb.shape[0]} ({time.time() - t0:.0f}s)")
    rgb = colorizer(rgb, saturation=saturation)
    log(f"  colourized ({time.time() - t0:.0f}s)")
    im = Image.fromarray(fit(rgb, max_output))
    if label:
        im = add_label(im)
    save_jpeg(im, out, quality)
    log(f"  -> {out} {im.size[0]}x{im.size[1]} ({time.time() - t0:.0f}s)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", type=Path)
    ap.add_argument("-o", "--output", type=Path, help="output file (single input only)")
    ap.add_argument("--out-dir", type=Path, help="output directory (default: next to the input)")
    ap.add_argument("--suffix", default="_ai", help="added to the file name when -o is not given (default: _ai)")
    ap.add_argument("--no-upscale", action="store_true", help="skip Real-ESRGAN")
    ap.add_argument("--saturation", type=float, default=1.2, help="multiplier for predicted colour (default 1.2)")
    ap.add_argument("--max-input", type=int, default=1200, help="downscale input to this long side before upscaling")
    ap.add_argument("--max-output", type=int, default=2000, help="long side of the saved image")
    ap.add_argument("--quality", type=int, default=88)
    ap.add_argument("--no-label", action="store_true", help="don't burn the 'AI' badge into the image")
    ap.add_argument("--device", default="auto", help="torch device for Real-ESRGAN: auto|cpu|mps|cuda")
    ap.add_argument("--model", type=Path, default=DDCOLOR_PATH, help="DDColor ONNX model")
    args = ap.parse_args()

    if args.output and len(args.inputs) > 1:
        ap.error("-o works with a single input; use --out-dir for several")

    upscaler = None if args.no_upscale else Upscaler(args.device)
    colorizer = Colorizer(args.model)
    for p in args.inputs:
        if args.output:
            out = args.output
        else:
            out = (args.out_dir or p.parent) / f"{p.stem}{args.suffix}.jpg"
        restore(
            p,
            out,
            upscaler=upscaler,
            colorizer=colorizer,
            max_input=args.max_input,
            max_output=args.max_output,
            saturation=args.saturation,
            label=not args.no_label,
            quality=args.quality,
        )


if __name__ == "__main__":
    main()
