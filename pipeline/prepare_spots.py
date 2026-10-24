"""Build the site's photos and spots.json from pipeline/sources/sources.json.

    uv run python prepare_spots.py              # all places
    uv run python prepare_spots.py plac-zamkowy # just one

Each place in sources.json has a list of photos from Wikimedia Commons (see README for the format). The
originals are downloaded once into sources/cache/ (gitignored). For each place it writes:
    public/img/places/<id>/<year>-<n>.jpg   each photo, resized for the web
    public/img/places/<id>/<year>-<n>p.jpg  96x96 crop for the map pin
    public/img/og/<id>.jpg                  1200x630 link preview (oldest | newest)
and rewrites src/data/spots.json. Places that aren't in sources.json are dropped from it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

import og

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
CACHE = SOURCES / "cache"
PUBLIC = HERE.parent / "public"
IMG = PUBLIC / "img"
SPOTS_JSON = HERE.parent / "src" / "data" / "spots.json"
WEB_SIDE = 1600
PIN_SIDE = 96
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
Image.MAX_IMAGE_PIXELS = 400_000_000
USER_AGENT = "warsaw-time-machine/1.0 (https://github.com/Nalhin/warsaw-time-machine)"


def fetch(url: str, retries: int = 4) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            return urllib.request.urlopen(req, timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1:
                raise
            time.sleep(30)
    raise RuntimeError(url)


def original(title: str) -> Path:
    name = re.sub(r"[^\w.-]+", "_", title.removeprefix("File:"))[-80:]
    path = CACHE / f"{hashlib.sha1(title.encode()).hexdigest()[:10]}-{name}"
    if path.exists():
        return path
    q = urllib.parse.urlencode({"action": "query", "prop": "imageinfo", "iiprop": "url", "titles": title, "format": "json"})
    page = next(iter(json.loads(fetch(f"{COMMONS_API}?{q}"))["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise SystemExit(f"Not on Commons: {title}")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fetch(page["imageinfo"][0]["url"]))
    time.sleep(1)
    print(f"  downloaded {title}")
    return path


def web_copy(src: Path, dst: Path, quality: int = 82) -> Image.Image:
    im = Image.open(src)
    im.draft("RGB", (WEB_SIDE, WEB_SIDE))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((WEB_SIDE, WEB_SIDE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
    return im


def pin_thumb(im: Image.Image, dst: Path) -> None:
    ImageOps.fit(im, (PIN_SIDE, PIN_SIDE), Image.LANCZOS).save(dst, "JPEG", quality=80, optimize=True)


def credit(p: dict) -> dict:
    page = p.get("page") or ""
    return {
        "author": p.get("author") or "unknown",
        "date": p.get("date") or None,
        "licence": p.get("licence") or "",
        "licenceUrl": p.get("licenceUrl") or None,
        "source": "Wikimedia Commons" if "commons.wikimedia.org" in page else (p.get("source") or "source"),
        "sourceUrl": page or p.get("sourceUrl") or None,
    }


def build(place: dict) -> dict:
    pid = place["id"]
    out_dir = IMG / "places" / pid
    photos, files = [], []
    seen: dict[int, int] = {}
    for p in sorted(place["photos"], key=lambda p: p["year"]):
        src = SOURCES / p["path"] if p.get("path") else original(p["file"])
        n = seen[p["year"]] = seen.get(p["year"], 0) + 1
        stem = f"{p['year']}-{n}"
        im = web_copy(src, out_dir / f"{stem}.jpg", quality=82 if p["year"] < 1990 else 80)
        pin_thumb(im, out_dir / f"{stem}p.jpg")
        files.append(src)
        photos.append(
            {
                "src": f"/img/places/{pid}/{stem}.jpg",
                "pin": f"/img/places/{pid}/{stem}p.jpg",
                "year": p["year"],
                "date": p.get("date") or str(p["year"]),
                "approx": bool(p.get("approx")),
                "ratio": round(im.width / im.height, 4),
                "caption": p.get("caption"),
                "pl": p.get("pl"),
                "credit": credit(p),
            }
        )
    og.spot_card(
        files[0], files[-1], place["name"], IMG / "og" / f"{pid}.jpg",
        old_label=photos[0]["date"], today_label="Today" if photos[-1]["year"] >= 2015 else photos[-1]["date"])
    return {
        "id": pid,
        "name": place["name"],
        "lat": place["lat"],
        "lng": place["lng"],
        "kind": place.get("kind", "historic"),
        "description": place.get("description"),
        "pl": place.get("pl"),
        "og": f"/img/og/{pid}.jpg",
        "photos": photos,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="only these place ids")
    args = ap.parse_args()

    places = json.loads((SOURCES / "sources.json").read_text())
    existing = {s["id"]: s for s in json.loads(SPOTS_JSON.read_text())} if SPOTS_JSON.exists() else {}
    out = []
    for place in places:
        if args.ids and place["id"] not in args.ids:
            if place["id"] in existing:
                out.append(existing[place["id"]])
            continue
        print(f"== {place['id']} ({len(place['photos'])} photos)")
        out.append(build(place))

    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items() if v is not None}
        if isinstance(o, list):
            return [clean(v) for v in o]
        return o

    SPOTS_JSON.write_text(json.dumps([clean(s) for s in out], ensure_ascii=False, indent=2) + "\n")
    print(f"-> {SPOTS_JSON} ({len(out)} places, {sum(len(s['photos']) for s in out)} photos)")


if __name__ == "__main__":
    main()
