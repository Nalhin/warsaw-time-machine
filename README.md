# Warsaw 1935 / 1945 / Today

A map of Warsaw that compares the city's aerial photos from 1935 (pre-war), 1945 (after the destruction)
and today. Pins open street-level comparisons: the real pre-war photo, an AI-restored version, and a photo
taken from the same spot today. It's a static site with no backend, deployed on Vercel.

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com) (Radix), Leaflet via react-leaflet.
The restoration pipeline is Python (uv, PyTorch, ONNX Runtime).

```
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build        # dist/ (+ dist/s/<id>/ share pages with Open Graph tags)
```

## Map

- Aerials come from the city WMS `https://mapa.um.warszawa.pl/mapviewer/wms` (WMS 1.1.1, `DATASOURCE=dane_wawa`,
  EPSG:3857, 512 px tiles). The layers are `FOTOPLAN_1935`, `ORTOFOTO_1945` and `ORTOFOTO_2025`.
- If 3 tiles fail before any succeeds, the app switches to the official `https://wms.um.warszawa.pl/serwis`
  (`RASTER_FOTOPLAN_1935`, `RASTER_ORTOFOTO_1945`, `ORTO`). See `src/lib/years.ts`.
- When you switch years, the new layer loads on top of the old one. The old layer is removed only after the
  new one has finished, so the map never goes blank. A progress bar and a "Wczytywanie…" pill show while
  tiles load.
- **The map opens in compare mode** (1935 | Today). The divider can be dragged with a mouse or touch, or moved
  with the arrow keys or `[` `]`. Double-click it to centre. Each side has its own year buttons, and ⇄ swaps
  the sides. It clips two Leaflet panes, so there's no plugin (`src/components/map/SwipeDivider.tsx`).
- Shortcuts: `1` `2` `3` set the year (the right side in compare mode; Shift sets the left side), `C`
  toggles compare, `S` swaps.
- In the spot panel, the before/after slider follows the mouse, and the expand button opens it full-screen.
- "T" toggles street names (CARTO labels). The target button shows your location.

### URL state

| URL | |
|---|---|
| `/` | compare mode, 1935 \| today (default) |
| `/?year=1945` | one year (`1935`, `1945`, `today`) |
| `/?swipe=1945,today` | compare mode, left and right |
| `/?spot=plac-zamkowy` | opens a spot (can be combined with the above) |
| `/s/plac-zamkowy/` | share link: its own OG image and title, then redirects to `/?spot=…` |

The share button in the panel copies `/s/<id>/?swipe=…`, which keeps the current map mode. X doesn't run
JavaScript, so per-spot previews need these static pages, which `scripts/build-spot-pages.mjs` generates
after `vite build`.

## Deploy (Vercel)

Import the repository in Vercel, or run `npx vercel --prod`. `vercel.json` sets the build command and cache headers.
`og:image` must be an absolute URL. The build reads `VERCEL_PROJECT_PRODUCTION_URL`, and you can override it
with `SITE_URL=https://your.domain` when you use a custom domain.

## Spots (`public/spots.json`)

```json
{ "id": "plac-zamkowy", "name": "Plac Zamkowy", "lat": 52.2477, "lng": 21.0136,
  "heading": "widok w stronę…", "description": "…", "oldYear": "1930",
  "old": "img/plac-zamkowy_old.jpg", "restored": "img/plac-zamkowy_ai.jpg", "today": "img/plac-zamkowy_today.jpg",
  "og": "img/og/plac-zamkowy.jpg",
  "credits": { "old":   { "author": "…", "date": "…", "licence": "Public domain", "licenceUrl": "…", "source": "Wikimedia Commons", "sourceUrl": "…" },
               "today": "author, licence, https://link" } }
```

`credits.*` can be an object (as above) or a plain string. URLs in a string become links. `restored`,
`og`, `heading`, `description` and `oldYear` are optional.

## Restoration pipeline (`pipeline/`, Python + uv)

```
cd pipeline
uv sync --extra export
uv run --extra export python export_ddcolor.py   # once: official DDColor weights -> models/ddcolor_modelscope_512.onnx (~1 GB)

uv run python restore.py photo.jpg               # -> photo_ai.jpg
uv run python restore.py *.jpg --out-dir out/    # batch
```

1. **Upscale**: Real-ESRGAN x2plus through `spandrel` and PyTorch, in tiles. The weights download
   automatically. Uses CPU, or MPS/CUDA when available. It takes a few seconds per photo on Apple Silicon.
2. **Colourize**: DDColor (ONNX, 512×512 input) runs on a downscaled grey copy. Its predicted a/b (Lab)
   channels are scaled up and applied to the full-resolution L channel, then saturation is multiplied by 1.2.
   All detail comes from the original photo.
3. **Label**: every output gets a burned-in badge reading "AI-restored · colours are a guess",
   plus an EXIF description. Use `--no-label` only if the image is labelled some other way.

Options: `--saturation`, `--no-upscale`, `--max-input`, `--max-output`, `--device cpu`.

> Only restore real photos. Never use image generators to invent historical scenes.

### From sources to the site

Put the photos in `pipeline/sources/` and describe them in `pipeline/sources/sources.json`:

```json
[{ "id": "plac-zamkowy", "name": "Plac Zamkowy", "lat": 52.24795, "lng": 21.01365,
   "heading": "…", "description": "…",
   "old":   { "file": "plac-zamkowy_old.jpg", "page": "https://commons.wikimedia.org/wiki/File:…",
              "author": "Henryk Poddębski", "date": "1930s", "licence": "Public domain", "licenceUrl": "…" },
   "today": { "file": "plac-zamkowy_today.jpg", "page": "…", "author": "…", "date": "2019", "licence": "CC BY-SA 4.0", "licenceUrl": "…" } }]
```

Then run:

```
uv run python prepare_spots.py               # all spots; restores only those without an _ai.jpg yet
uv run python prepare_spots.py nowy-swiat --force
uv run python og.py default                  # main link preview from the WMS (1935 | 1945 | today)
```

This writes web-sized `public/img/<id>_{old,ai,today}.jpg`, `public/img/og/<id>.jpg` (1200×630, old | today)
and updates `public/spots.json`. Entries that aren't in `sources.json` are left alone.

### Photo sources and licences

- Wikimedia Commons (pre-1939 Polish photos are usually public domain, e.g. `PD-Polish`), NAC
  (szukajwarchiwach.gov.pl), Polona.
- Always record the author, licence and source link. They're shown under every photo.
- Today's photos: CC-licensed from Commons, or take your own from the same angle. Your own photos give the
  best before/after alignment.

## Credits

Aerial photos © m.st. Warszawa. Labels and basemap © OpenStreetMap contributors, © CARTO.
Real-ESRGAN (BSD-3-Clause), DDColor (Apache-2.0), fonts Fraunces, Inter and Geist (OFL).

Code: [MIT](LICENSE). Photos keep their own licences (see `public/spots.json`). Contributions:
[CONTRIBUTING.md](CONTRIBUTING.md).
