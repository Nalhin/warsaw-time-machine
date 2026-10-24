# Contributing

Thanks for helping. The most valuable contributions are **new spots**: a pre-war photo of a Warsaw place,
plus a photo of the same view today.

## Setup

```
npm install
npm run dev           # http://localhost:3000
npm run typecheck
npm run build         # must pass before you open a PR
```

The pipeline (only needed for new spots) uses Python and [uv](https://docs.astral.sh/uv/):

```
cd pipeline
uv sync
```

## Adding a place

1. **Find photos from different decades** on Wikimedia Commons: before 1939, 1944–45, the rebuilding, the
   1960s–80s, the 2000s and today, matching the map's years where possible. Photos published in Poland before
   1994 are often public domain (`PD-Polish`); recent ones are usually CC BY-SA. Your own photo of today is
   welcome too (upload it to Commons as CC BY-SA 4.0 or CC0).
2. Add the place to `pipeline/sources/sources.json` (see the README for the format). The Commons title, year,
   author, licence and source page are **required** for every photo.
3. Set `lat`/`lng` to the place itself: the middle of the building, the centre of the square. Check it on the
   2025 aerial on the map.
4. Run `uv run python prepare_spots.py <id>`, then check the result in `npm run dev`.
5. Open a PR with the `sources.json` change, the generated `public/img/*` files and `src/data/spots.json`.

### Rules for photos

- Use the original photographs as they are: no colourising, upscaling or AI-generated images.
- If you're not sure a photo's licence allows reuse, leave it out.
- Descriptions are in English, short and factual. Avoid speculation, especially about wartime events.

## Code

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com) (Radix base).
  Add UI primitives with `npx shadcn@latest add <component>` rather than writing them by hand.
- Map: Leaflet through react-leaflet. The year layers and the compare divider are in `src/components/map/`.
- Keep URLs (`/spots/<id>`, `?year=`, `?swipe=`) backwards compatible, because links get shared and indexed.
- Leaflet only runs in the browser, so keep it out of server components and out of the `src/lib/` modules that pages import.
- Don't write code comments. Explain non-obvious decisions in the PR description.
- The WMS is slow, so don't add features that multiply tile requests (e.g. preloading every year).
- Keep pull requests focused. Describe what changed and include a screenshot for UI changes.

## Reporting problems

Open an issue with the URL (it includes the map state), your browser and device, and a screenshot. To report a
wrong photo credit or a licensing problem, link the source page and we'll fix or remove the photo quickly.
