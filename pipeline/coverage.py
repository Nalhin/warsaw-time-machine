import io
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

WMS = "https://mapa.um.warszawa.pl/mapviewer/wms"
LAYERS = {
    "1935": ("FOTOPLAN_1935", "texture"),
    "1945": ("ORTOFOTO_1945", "white"),
    "1951": ("ZDJECIA_1951", "dark"),
    "1972": ("ZDJECIA_1972", "dark"),
    "1987": ("FOTOSZKIC_1987", "dark"),
    "2001": ("ORTOFOTO_2001", "dark"),
    "2010": ("ORTOFOTO_2010", "alpha"),
    "today": ("ORTOFOTO_2025", "alpha"),
}
WEST, SOUTH, EAST, NORTH = 20.6, 51.95, 21.5, 52.5
WIDTH = 8192
SCALE = 4
BAND = 80
PAPER = 185
INSET = 6
BLACK = 8
R = 6378137.0
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "coverage.json"


def merc(lat, lng):
    return math.radians(lng) * R, math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R


def unmerc(x, y):
    return math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2), math.degrees(x / R)


def fetch(layer, bbox, width, height):
    q = urllib.parse.urlencode({
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.1.1", "LAYERS": layer, "STYLES": "",
        "FORMAT": "image/png", "TRANSPARENT": "TRUE", "SRS": "EPSG:3857",
        "BBOX": ",".join(f"{v:.2f}" for v in bbox), "WIDTH": width, "HEIGHT": height, "DATASOURCE": "dane_wawa",
    })
    with urllib.request.urlopen(f"{WMS}?{q}", timeout=120) as r:
        return np.array(Image.open(io.BytesIO(r.read())).convert("RGBA"))


def fetch_tiled(layer, bbox, width, height, tile=2048):
    x0, y0, x1, y1 = bbox
    out = np.zeros((height, width, 4), np.uint8)
    for top in range(0, height, tile):
        for left in range(0, width, tile):
            w, h = min(tile, width - left), min(tile, height - top)
            sub = (
                x0 + (x1 - x0) * left / width,
                y1 - (y1 - y0) * (top + h) / height,
                x0 + (x1 - x0) * (left + w) / width,
                y1 - (y1 - y0) * top / height,
            )
            out[top:top + h, left:left + w] = fetch(layer, sub, w, h)
    return out


def imagery_mask(rgba, mode):
    opaque = rgba[:, :, 3] > 0
    if mode == "alpha":
        return opaque.astype(np.uint8)
    if mode == "white":
        return (opaque & (rgba[:, :, :3].min(axis=2) < 250)).astype(np.uint8)
    if mode == "dark":
        rgb = rgba[:, :, :3]
        return (opaque & (rgb.min(axis=2) < 250) & (rgb.max(axis=2) > BLACK)).astype(np.uint8)
    gray = cv2.GaussianBlur(cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.5)
    mean = cv2.blur(gray, (7, 7))
    std = np.sqrt(np.maximum(cv2.blur(gray * gray, (7, 7)) - mean * mean, 0))
    return ((std > 2) & opaque).astype(np.uint8)


def fill_holes(m):
    h, w = m.shape
    padded = np.pad(m, 1)
    flood = padded.copy()
    cv2.floodFill(flood, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 1)
    return padded[1:-1, 1:-1] | (1 - flood[1:-1, 1:-1])


def largest_component(m):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
    return (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)


def disk(d):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d, d))


def smooth(m, sigma, threshold):
    return (cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma) > threshold).astype(np.uint8)


def gaps(rgba, inside, mode, min_area=200):
    blank = (rgba[:, :, 3] == 0) | (rgba[:, :, :3].min(axis=2) >= 250)
    if mode == "dark":
        blank |= rgba[:, :, :3].max(axis=2) <= BLACK
    m = cv2.morphologyEx(blank.astype(np.uint8) & inside, cv2.MORPH_OPEN, disk(5))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m)
    big = np.isin(labels, 1 + np.flatnonzero(stats[1:, cv2.CC_STAT_AREA] >= min_area))
    return smooth(cv2.dilate(big.astype(np.uint8), disk(3)), 1.5, 0.5)


def coarse_shape(rgba, mode):
    m = cv2.morphologyEx(imagery_mask(rgba, mode), cv2.MORPH_OPEN, disk(11))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disk(13))
    m = largest_component(fill_holes(m))
    return smooth(cv2.morphologyEx(m, cv2.MORPH_OPEN, disk(21)), 4, 0.6)


def touching_border(m):
    n, labels = cv2.connectedComponents(m)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    return np.isin(labels, edge[edge > 0]).astype(np.uint8)


def outline(fine, mode):
    h, w = fine.shape[:2]
    coarse = cv2.resize(fine, (w // SCALE, h // SCALE), interpolation=cv2.INTER_AREA)
    base = coarse_shape(coarse, mode)
    up = lambda m: smooth(cv2.resize(m.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR), 0.5, 0.5)
    shape = up(base)
    gray = cv2.GaussianBlur(cv2.cvtColor(fine[:, :, :3], cv2.COLOR_RGB2GRAY), (0, 0), 3)
    blank = (1 - cv2.morphologyEx(imagery_mask(fine, mode), cv2.MORPH_OPEN, disk(9))) & (gray > PAPER)
    band = shape & (1 - cv2.erode(shape, disk(2 * BAND + 1)))
    cut = touching_border(blank | (1 - shape)) & band
    m = smooth(shape & (1 - cut), 3, 0.5)
    m = cv2.erode(m, disk(2 * INSET + 1))
    m = largest_component(m & (1 - up(gaps(coarse, base, mode))))
    found, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    return [cv2.approxPolyDP(c, 2.0, True)[:, 0, :] for c in found if cv2.contourArea(c) > 20 * SCALE**2]


def main():
    x0, y0 = merc(SOUTH, WEST)
    x1, y1 = merc(NORTH, EAST)
    height = round(WIDTH * (y1 - y0) / (x1 - x0))
    sx, sy = (x1 - x0) / WIDTH, (y1 - y0) / height
    keys = sys.argv[1:] or list(LAYERS)
    result = json.loads(OUT.read_text()) if OUT.exists() else {}
    for key in keys:
        layer, mode = LAYERS[key]
        rings = outline(fetch_tiled(layer, (x0, y0, x1, y1), WIDTH, height), mode)
        result[key] = [
            [[round(v, 5) for v in unmerc(x0 + (px + 0.5) * sx, y1 - (py + 0.5) * sy)] for px, py in ring]
            for ring in rings
        ]
        print(key, [len(r) for r in rings])
    result = {k: result[k] for k in LAYERS if k in result}
    OUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
