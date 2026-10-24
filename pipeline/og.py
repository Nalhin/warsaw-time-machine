"""Open Graph images (1200x630) for X/Facebook link previews.

    uv run python og.py default        # public/img/og/default.jpg from the city WMS (1935 | 1945 | today)
    uv run python og.py spots          # public/img/og/<id>.jpg for every spot, from its web photos

prepare_spots.py also calls spot_card() for the places it rebuilds.
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
PUBLIC = HERE.parent / "public"
SPOTS_JSON = HERE.parent / "src" / "data" / "spots.json"
W, H = 1200, 630

WHITE = (255, 255, 255)
GOLD = (227, 182, 103)
PILL_BG = (17, 18, 20, 214)
PILL_FG = (243, 239, 231)
CREDIT = (255, 255, 255, 153)
TEXT_SHADOW = (0, 0, 0, 115)
HANDLE_SHADOW = (0, 0, 0, 89)
SHADE_ALPHA = 224
DOMAIN_PARTS = (("warsaw", WHITE), ("timelapse", GOLD), (".com", WHITE))
PAD, MARGIN, LINE = 44, 28, 3
PILL_H, PILL_PAD_X, HANDLE_R = 46, 16, 28

FONT_URLS = {
    "Fraunces.ttf": "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf",
    "Inter.ttf": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
}

WMS = "https://mapa.um.warszawa.pl/mapviewer/wms"
UA = {"User-Agent": "warsaw-timelapse/0.1 (+og.py)"}


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
        pass
    return f


def cover(im: Image.Image, w: int, h: int, centering=(0.5, 0.5)) -> Image.Image:
    return ImageOps.fit(im.convert("RGB"), (w, h), Image.LANCZOS, centering=centering)


def shade(im: Image.Image, top: float) -> Image.Image:
    start = int(H * top)
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), round(SHADE_ALPHA * max(0.0, (y - start) / (H - start))))
    return Image.composite(Image.new("RGB", im.size, (10, 10, 12)), im, grad.resize(im.size)).convert("RGBA")


def overlay(img: Image.Image, draw, blur: float = 0) -> None:
    layer = Image.new("RGBA", img.size)
    draw(ImageDraw.Draw(layer))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)) if blur else layer)


def shadowed_text(img: Image.Image, runs: list[tuple]) -> None:
    def shadows(d: ImageDraw.ImageDraw) -> None:
        for xy, text, f, _, anchor in runs:
            d.text(xy, text, font=f, fill=TEXT_SHADOW, anchor=anchor)

    overlay(img, shadows, blur=6)
    d = ImageDraw.Draw(img)
    for xy, text, f, fill, anchor in runs:
        d.text(xy, text, font=f, fill=fill, anchor=anchor)


def wordmark(x: int, baseline: int, size: int) -> tuple[list[tuple], int]:
    f = font("Inter.ttf", size, 700)
    runs, left = [], x
    for text, color in DOMAIN_PARTS:
        runs.append(((left, baseline), text, f, color, "ls"))
        left += round(f.getlength(text))
    return runs, left - x


def pill(img: Image.Image, xy: tuple[int, int], text: str, anchor: str = "left") -> None:
    f = font("Inter.ttf", 26, 600)
    d = ImageDraw.Draw(img)
    l, _, r, _ = d.textbbox((0, 0), text, font=f, anchor="ls")
    cap = -d.textbbox((0, 0), "H", font=f, anchor="ls")[1]
    w, h = r - l + PILL_PAD_X * 2, PILL_H
    x, y = (xy[0] - w if anchor == "right" else xy[0]), xy[1]
    overlay(img, lambda o: o.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=PILL_BG))
    d.text((x + PILL_PAD_X - l, y + (h + cap) // 2), text, font=f, fill=PILL_FG, anchor="ls")


def handle(img: Image.Image, cx: int, cy: int) -> None:
    r = HANDLE_R
    overlay(img, lambda o: o.ellipse((cx - r, cy - r, cx + r, cy + r), fill=HANDLE_SHADOW), blur=7)
    d = ImageDraw.Draw(img)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=WHITE)
    for s in (-1, 1):
        d.polygon([(cx + s * 16, cy), (cx + s * 6, cy - 9), (cx + s * 6, cy + 9)], fill=(24, 24, 27))


def fit_title(title: str, max_w: int) -> tuple[list[str], ImageFont.FreeTypeFont]:
    for size in (64, 58, 52, 46):
        f = font("Inter.ttf", size, 700)
        if f.getlength(title) <= max_w:
            return [title], f
    f = font("Inter.ttf", 50, 700)
    lines = [""]
    for word in title.split():
        trial = f"{lines[-1]} {word}".strip()
        if f.getlength(trial) <= max_w or not lines[-1]:
            lines[-1] = trial
        else:
            lines.append(word)
    return lines[:2], f


def save(img: Image.Image, out: Path, sharpen: bool = False) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    rgb = img.convert("RGB")
    if sharpen:
        rgb = rgb.filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    rgb.save(out, "JPEG", quality=86, optimize=True, progressive=True)


def spot_labels(photos: list[dict]) -> tuple[str, str]:
    return photos[0]["date"], "Today" if photos[-1]["year"] >= 2015 else photos[-1]["date"]


def spot_card(old: Path, today: Path, title: str, out: Path, old_label: str = "Pre-war", today_label: str = "Today") -> None:
    half = W // 2
    img = Image.new("RGB", (W, H))
    img.paste(cover(ImageOps.grayscale(Image.open(old)).convert("RGB"), half, H), (0, 0))
    img.paste(cover(Image.open(today), half, H), (half, 0))
    img = shade(img, top=0.42)
    ImageDraw.Draw(img).rectangle((half - LINE // 2, 0, half - LINE // 2 + LINE - 1, H), fill=WHITE)
    handle(img, half, H // 2)
    pill(img, (MARGIN, MARGIN), old_label)
    pill(img, (W - MARGIN, MARGIN), today_label, anchor="right")

    lines, big = fit_title(title, W - PAD * 2)
    mark, _ = wordmark(PAD, H - PAD, 30)
    line_h = round(big.size * 1.12)
    title_runs = [
        ((PAD - 2, H - PAD - 58 - i * line_h), line, big, WHITE, "ls") for i, line in enumerate(reversed(lines))
    ]
    shadowed_text(img, title_runs + mark)
    save(img, out)


def spots_cards() -> None:
    for spot in json.loads(SPOTS_JSON.read_text()):
        photos = spot["photos"]
        old, today = (PUBLIC / photos[i]["src"].lstrip("/") for i in (0, -1))
        out = PUBLIC / spot["og"].lstrip("/")
        spot_card(old, today, spot["name"], out, *spot_labels(photos))
        print(f"-> {out}", file=sys.stderr)


def wms_image(layer: str, bbox: tuple[float, float, float, float], size: tuple[int, int]) -> Image.Image:
    q = (
        f"{WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS={layer}&STYLES=&FORMAT=image/jpeg"
        f"&SRS=EPSG:3857&BBOX={','.join(f'{v:.1f}' for v in bbox)}&WIDTH={size[0]}&HEIGHT={size[1]}"
        f"&DATASOURCE=dane_wawa"
    )
    with urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def default_card(out: Path) -> None:
    import math

    lat, lng = 52.2462, 21.0125
    x = lng * 20037508.34 / 180
    y = math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi
    m_per_px = 1.25
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
    card = shade(card, top=0.45)
    d = ImageDraw.Draw(card)
    for i in (1, 2):
        d.rectangle((i * strip - LINE // 2, 0, i * strip - LINE // 2 + LINE - 1, H), fill=WHITE)
    for i, (_, label) in enumerate(layers):
        pill(card, (i * strip + MARGIN, MARGIN), label)

    mark, _ = wordmark(PAD - 3, H - PAD - 46, 72)
    tagline = font("Inter.ttf", 26, 500)
    credit = font("Inter.ttf", 19, 400)
    shadowed_text(card, mark + [((PAD, H - PAD), "Warsaw in 1935, after the destruction in 1945, and today", tagline, PILL_FG, "ls")])
    ImageDraw.Draw(card).text((W - PAD, H - PAD), "Aerial photos © m.st. Warszawa", font=credit, fill=CREDIT, anchor="rs")
    save(card, out, sharpen=True)
    print(f"-> {out}", file=sys.stderr)

if __name__ == "__main__":
    if sys.argv[1:] == ["default"]:
        default_card(PUBLIC / "img" / "og" / "default.jpg")
    elif sys.argv[1:] == ["spots"]:
        spots_cards()
    else:
        sys.exit(__doc__)
