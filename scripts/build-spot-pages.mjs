// After `vite build`: writes dist/s/<id>/index.html for every spot.
//
// X, Facebook and others don't run JavaScript, so a link like /?spot=plac-zamkowy would always
// preview with the generic card. Each /s/<id>/ page has its own Open Graph tags and immediately
// redirects people to /?spot=<id> (keeping ?swipe= / ?year= from the shared link).
//
// og:image must be an absolute URL. Set SITE_URL (e.g. https://warsaw1935.com); on Vercel the
// production URL is picked up automatically.

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const spots = JSON.parse(await readFile(new URL('spots.json', dist), 'utf8'));

const site = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  ''
).replace(/\/$/, '');
if (!site) console.warn('[spot-pages] SITE_URL not set: og:image will be relative and X will not show the preview.');

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const page = (s) => {
  const title = `${s.name}: Warsaw before the war and today`;
  const desc = s.description || 'A pre-war photograph, an AI-restored version, and the same spot today.';
  const image = `${site}/${s.og || 'img/og/default.jpg'}`;
  const target = `/?spot=${encodeURIComponent(s.id)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${site}/s/${s.id}/" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="en_GB" />
<meta property="og:site_name" content="Warsaw 1935 / 1945 / Today" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${site}/s/${s.id}/" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(`${s.name}: before the war and today`)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0; url=${target}" />
<script>
  var q = location.search.replace(/^\\?/, '');
  location.replace(${JSON.stringify(target)} + (q ? '&' + q : ''));
</script>
<style>body{background:#111214;color:#f3efe7;font:16px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}a{color:#e2b764}</style>
</head>
<body><a href="${target}">${esc(s.name)}: open the map</a></body>
</html>
`;
};

for (const s of spots) {
  const dir = new URL(`s/${s.id}/`, dist);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), page(s));
}

// Absolute og:image on the main page too.
if (site) {
  const indexUrl = new URL('index.html', dist);
  const html = await readFile(indexUrl, 'utf8');
  await writeFile(
    indexUrl,
    html
      .replace('content="/img/og/default.jpg"', `content="${site}/img/og/default.jpg"`)
      .replace('<meta name="twitter:card"', `<meta property="og:url" content="${site}/" />\n    <meta name="twitter:card"`),
  );
}

console.log(`[spot-pages] ${spots.length} pages in dist/s/ (site: ${site || 'relative'})`);
