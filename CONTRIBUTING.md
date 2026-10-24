# Contributing

Thanks for helping. The most valuable contributions are **new spots**: a pre-war photo of a Warsaw place,
plus a photo of the same view today.

## Setup

```
npm install
npm run dev           # http://localhost:5173
npm run typecheck
npm run build         # must pass before you open a PR
```

The pipeline (only needed for new spots) uses Python and [uv](https://docs.astral.sh/uv/):

```
cd pipeline
uv sync --extra export
uv run --extra export python export_ddcolor.py   # once, about 1 GB
```

## Adding a spot

1. **Find an old photo** taken before 1939 that is clearly public domain: Wikimedia Commons (`PD-Polish`,
   `PD-old`), NAC (szukajwarchiwach.gov.pl) or Polona. Street-level views work best.
2. **Find or take a photo for today** from the same position and angle. Your own photo is ideal (license it
   CC BY-SA 4.0 or CC0). Otherwise use a freely licensed photo from Commons.
3. Save both photos as `pipeline/sources/<id>_old.jpg` and `pipeline/sources/<id>_today.jpg`, then add an
   entry to `pipeline/sources/sources.json` (see the README for the format). The author, date, licence and
   source page are **required** for both photos.
4. Set `lat`/`lng` to where the photographer stood, not to the building in the photo. Check it against the
   1935 aerial on the map.
5. Run `uv run python prepare_spots.py <id>`, then check the result in `npm run dev`.
6. Open a PR with the source files, the generated `public/img/*` files and the `public/spots.json` change.

### Rules for photos

- **Real photos only.** Never use image generators to create or "complete" historical scenes. The AI step only
  restores an existing photograph: it upscales it and guesses colours.
- AI-restored images must keep the "AI-restored · colours are a guess" label, both burned into the image and
  shown in the UI.
- If you're not sure a photo's licence allows reuse, leave it out.
- Descriptions are in English, short and factual. Avoid speculation, especially about wartime events.

## Code

- Frontend: React, TypeScript, Vite, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com) (Radix base).
  Add UI primitives with `npx shadcn@latest add <component>` rather than writing them by hand.
- Map: Leaflet through react-leaflet. The year layers and the compare divider are in `src/components/map/`.
- Keep the URL parameters (`?year=`, `?swipe=`, `?spot=`) backwards compatible, because links get shared.
- The WMS is slow, so don't add features that multiply tile requests (e.g. preloading every year).
- Keep pull requests focused. Describe what changed and include a screenshot for UI changes.

## Reporting problems

Open an issue with the URL (it includes the map state), your browser and device, and a screenshot. To report a
wrong photo credit or a licensing problem, link the source page and we'll fix or remove the photo quickly.
