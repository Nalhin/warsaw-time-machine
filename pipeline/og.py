"""Open Graph images (1200x630) for X/Facebook link previews.

    uv run python og.py default        # public/img/og/default.jpg from the city WMS (1935 | 1945 | today)

Per-spot images are made by prepare_spots.py, which calls spot_card().
"""

from __future__ import annotations

import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
PUBLIC = HERE.parent / "public"
W, H = 1200, 630

# OFL fonts from the google/fonts repo (variable fonts; Pillow selects the weight).
FONT_URLS = {
    "Fraunces.ttf": "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf",
    "Inter.ttf": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
}

WMS = "https://mapa.um.warszawa.pl/mapviewer/wms"
UA = {"User-Agent": "warsaw-1935-1945-today/0.1 (+og.py)"}


def font(name: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    path = FONTS / name
    if not path.exists():
        FONTS.mkdir(exist_ok=True)
        print(f"Downloading font {name}", file=sys.stderr)
        urllib.request.urlretrieve(FONT_URLS[name], path)
    f = ImageFont.truetype(str(path), size)
    try:
        axes = f.get_variation_axes()
        values = []
        for a in axes:
            tag = a.get("name", b"")
            tag = tag.decode() if isinstance(tag, bytes) else str(tag)
            if tag.lower().startswith("weight"):
                values.append(weight)
            elif tag.lower().startswith("optical"):
                values.append(min(max(size, a["minimum"]), a["maximum"]))
            else:
                values.append(a["default"])
        f.set_variation_by_axes(values)
    except (OSError, AttributeError):
        pass  # static font or FreeType without variation support
    return f


def cover(im: Image.Image, w: int, h: int, centering=(0.5, 0.5)) -> Image.Image:
    return ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS, centering=centering)


def shade(im: Image.Image, top: int = 0, bottom: int = 330) -> Image.Image:
    """Dark gradient at the bottom so white text stays readable on any photo."""
    grad = Image.new("L", (1, H))
    for y in range(H):
        t = max(0.0, (y - (H - bottom)) / bottom)
        grad.putpixel((0, y), int(225 * t**1.4))
    mask = grad.resize(im.size)
    return Image.composite(Image.new("RGB", im.size, (10, 10, 12)), im, mask)


def pill(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, f, fill, fg, anchor="la") -> None:
    x, y = xy
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    pw, ph = r - l + 28, b - t + 16
    if anchor == "ra":
        x -= pw
    d.rounded_rectangle((x, y, x + pw, y + ph), radius=ph // 2, fill=fill)
    d.text((x + 14 - l, y + 8 - t), text, font=f, fill=fg)


def spot_card(old: Path, today: Path, title: str, out: Path, old_label: str = "Pre-war") -> None:
    """Old photo | today photo, split down the middle, with the place name."""
    half = W // 2
    img = Image.new("RGB", (W, H))
    img.paste(cover(ImageOps.grayscale(Image.open(old)).convert("RGB"), half, H), (0, 0))
    img.paste(cover(Image.open(today), half, H), (half, 0))
    img = shade(img)
    d = ImageDraw.Draw(img)
    d.rectangle((half - 2, 0, half + 1, H), fill=(255, 255, 255))
    # handle
    d.ellipse((half - 26, H // 2 - 26, half + 26, H // 2 + 26), fill=(255, 255, 255))
    arrow = font("Inter.ttf", 26, 700)
    d.text((half, H // 2), "⇆", font=arrow, fill=(20, 20, 20), anchor="mm")

    tag = font("Inter.ttf", 24, 600)
    pill(d, (28, 28), old_label, tag, (17, 18, 20), (243, 239, 231))
    pill(d, (W - 28, 28), "Today", tag, (17, 18, 20), (243, 239, 231), anchor="ra")

    big = font("Fraunces.ttf", 68 if len(title) < 22 else 54, 600)
    small = font("Inter.ttf", 25, 500)
    d.text((40, H - 118), title, font=big, fill=(255, 255, 255), anchor="ls")
    d.text((42, H - 62), "Warsaw 1935 · 1945 · today", font=small, fill=(226, 183, 100), anchor="ls")
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)


def wms_image(layer: str, bbox: tuple[float, float, float, float], size: tuple[int, int]) -> Image.Image:
    q = (
        f"{WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS={layer}&STYLES=&FORMAT=image/jpeg"
        f"&SRS=EPSG:3857&BBOX={','.join(f'{v:.1f}' for v in bbox)}&WIDTH={size[0]}&HEIGHT={size[1]}"
        f"&DATASOURCE=dane_wawa"
    )
    with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def default_card(out: Path) -> None:
    """Three strips of the same area (Stare Miasto / Krakowskie Przedmieście) in 1935, 1945 and today."""
    import math

    lat, lng = 52.2462, 21.0125
    x = lng * 20037508.34 / 180
    y = math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi
    m_per_px = 1.25  # ~ zoom 17 at this latitude
    w, h = W * m_per_px / 2, H * m_per_px / 2
    bbox = (x - w, y - h, x + w, y + h)
    layers = [("FOTOPLAN_1935", "1935"), ("ORTOFOTO_1945", "1945"), ("ORTOFOTO_2025", "Today")]
    imgs = [wms_image(layer, bbox, (W, H)) for layer, _ in layers]
    imgs[0] = ImageOps.autocontrast(imgs[0].convert("L"), cutoff=1).convert("RGB")
    imgs[1] = ImageOps.autocontrast(imgs[1].convert("L"), cutoff=1).convert("RGB")

    card = Image.new("RGB", (W, H))
    strip = W // 3
    for i, im in enumerate(imgs):
        card.paste(im.crop((i * strip, 0, (i + 1) * strip, H)), (i * strip, 0))
    card = shade(card, bottom=360)
    d = ImageDraw.Draw(card)
    tag = font("Inter.ttf", 24, 600)
    for i, (_, label) in enumerate(layers):
        if i:
            d.rectangle((i * strip - 1, 0, i * strip + 1, H), fill=(255, 255, 255))
        pill(d, (i * strip + 24, 24), label, tag, (17, 18, 20), (243, 239, 231))
    big = font("Fraunces.ttf", 74, 600)
    small = font("Inter.ttf", 26, 500)
    d.text((40, H - 112), "Warsaw 1935 · 1945 · today", font=big, fill=(255, 255, 255), anchor="ls")
    d.text((42, H - 58), "Aerial and street photos: before the war, after the destruction, today", font=small, fill=(226, 183, 100), anchor="ls")
    out.parent.mkdir(parents=True, exist_ok=True)
    card.filter(ImageFilter.UnsharpMask(1.2, 60, 2)).save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"-> {out}", file=sys.stderr)


if __name__ == "__main__":
    if sys.argv[1:] == ["default"]:
        default_card(PUBLIC / "img" / "og" / "default.jpg")
    else:
        sys.exit(__doc__)
