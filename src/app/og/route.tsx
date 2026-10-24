import { ImageResponse } from 'next/og';
import { NextResponse, type NextRequest } from 'next/server';
import sharp, { type OverlayOptions } from 'sharp';

import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { readOgScene, type OgScene } from '@/lib/og-scene';
import { SITE_DOMAIN_PARTS } from '@/lib/site';
import { fadeWhite, FALLBACK_URL, getMapUrl, metersPerPixel, PRIMARY_URL, project, type BBox } from '@/lib/wms-request';
import { featherPx, yearDef, type YearKey } from '@/lib/years';

const W = 1200;
const H = 630;
const PAD = 44;
const MARGIN = 28;
const LINE = 3;
const PILL_H = 46;
const HANDLE_R = 28;
const BG = '#1a1b1e';
const PILL_BG = 'rgba(17, 18, 20, 0.84)';
const PILL_FG = '#f3efe7';
const GOLD = '#e3b667';
const PRIMARY_TIMEOUT_MS = 5000;
const FALLBACK_TIMEOUT_MS = 3000;
const FONT_TIMEOUT_MS = 3000;
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700';
const FALLBACK_IMAGE = '/img/og/default.jpg';
const CACHE = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=31536000';

type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'];
type FontWeight = 400 | 600 | 700;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let fontsJob: Promise<Fonts> | null = null;

function loadFonts() {
  fontsJob ??= (async () => {
    const signal = AbortSignal.timeout(FONT_TIMEOUT_MS);
    const css = await fetch(FONT_CSS, { signal }).then((r) => r.text());
    const faces = [...css.matchAll(/font-weight: (\d+);\s*src: url\((.+?)\)/g)];
    if (!faces.length) throw new Error('[og] no Inter faces in Google Fonts CSS');
    return Promise.all(
      faces.map(async ([, weight, url]) => ({
        name: 'Inter',
        weight: Number(weight) as FontWeight,
        style: 'normal' as const,
        data: await fetch(url, { signal }).then((r) => r.arrayBuffer()),
      })),
    );
  })();
  fontsJob.catch(() => (fontsJob = null));
  return fontsJob;
}

function cameraBBox({ camera }: OgScene): BBox {
  const [x, y] = project(camera.lat, camera.lng);
  const mpp = metersPerPixel(camera.zoom);
  return [x - (W / 2) * mpp, y - (H / 2) * mpp, x + (W / 2) * mpp, y + (H / 2) * mpp];
}

async function fetchPng(url: string, timeoutMs: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`[og] GetMap failed: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchYear(year: YearKey, bbox: BBox) {
  const def = yearDef(year);
  try {
    return await fetchPng(getMapUrl(PRIMARY_URL, def.layer, bbox, W, H), PRIMARY_TIMEOUT_MS);
  } catch (error) {
    if (!def.fallbackLayer) throw error;
    return fetchPng(getMapUrl(FALLBACK_URL, def.fallbackLayer, bbox, W, H), FALLBACK_TIMEOUT_MS);
  }
}

async function blankWhite(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  fadeWhite(data);
  return sharp(data, { raw: info }).png({ compressionLevel: 0 }).toBuffer();
}

function coverageMask(year: YearKey, bbox: BBox, feather: number) {
  const scale = W / (bbox[2] - bbox[0]);
  const pad = feather * 8;
  const rings = yearDef(year)
    .outline.map((ring) => {
      const points = ring.map(([lat, lng]) => {
        const [x, y] = project(lat, lng);
        return `${((x - bbox[0]) * scale).toFixed(1)},${((bbox[3] - y) * scale).toFixed(1)}`;
      });
      return `M${points.join('L')}Z`;
    })
    .join('');
  const path = `M${-pad},${-pad}H${W + pad}V${H + pad}H${-pad}Z${rings}`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${feather}"/></filter>` +
      `<path d="${path}" fill="${BG}" fill-rule="evenodd" stroke="${BG}" stroke-width="${feather * 4}" stroke-linejoin="round" filter="url(#f)"/>` +
      `</svg>`,
  );
}

async function renderPanel(year: YearKey, bbox: BBox, feather: number) {
  const photo = await fetchYear(year, bbox);
  const layer = yearDef(year).whiteIsBlank ? await blankWhite(photo) : photo;
  return sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([{ input: layer }, { input: coverageMask(year, bbox, feather) }])
    .png({ compressionLevel: 0 })
    .toBuffer();
}

function secondRect(split: number, isHorizontal: boolean): Rect {
  return isHorizontal
    ? { left: 0, top: split, width: W, height: H - split }
    : { left: split, top: 0, width: W - split, height: H };
}

function Pill({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        height: PILL_H,
        padding: '0 16px',
        borderRadius: PILL_H / 2,
        background: PILL_BG,
        color: PILL_FG,
        fontSize: 26,
        fontWeight: 600,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

function Handle({ split, isHorizontal }: { split: number; isHorizontal: boolean }) {
  const [cx, cy] = isHorizontal ? [W / 2, split] : [split, H / 2];
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        left: cx - HANDLE_R,
        top: cy - HANDLE_R,
        width: HANDLE_R * 2,
        height: HANDLE_R * 2,
        borderRadius: HANDLE_R,
        background: '#fff',
        boxShadow: '0 0 14px rgba(0, 0, 0, 0.35)',
        ...(isHorizontal && { transform: 'rotate(90deg)' }),
      }}
    >
      <svg width={HANDLE_R * 2} height={HANDLE_R * 2} viewBox="-28 -28 56 56">
        <path d="M-16 0L-6 -9L-6 9Z M16 0L6 -9L6 9Z" fill="#18181b" />
      </svg>
    </div>
  );
}

function Overlay({ labels, split, isHorizontal, credit }: { labels: string[]; split: number | null; isHorizontal: boolean; credit: string }) {
  const [name, product, tld] = SITE_DOMAIN_PARTS;
  const second = split === null ? null : isHorizontal ? { left: MARGIN, top: split + MARGIN } : { right: MARGIN, top: MARGIN };
  return (
    <div style={{ display: 'flex', position: 'relative', width: W, height: H, fontFamily: 'Inter' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: H * 0.34,
          backgroundImage: 'linear-gradient(to bottom, rgba(10, 10, 12, 0), rgba(10, 10, 12, 0.88))',
        }}
      />
      {split !== null && (
        <div
          style={{
            position: 'absolute',
            background: '#fff',
            ...(isHorizontal
              ? { left: 0, top: split - LINE / 2, width: W, height: LINE }
              : { left: split - LINE / 2, top: 0, width: LINE, height: H }),
          }}
        />
      )}
      {split !== null && <Handle split={split} isHorizontal={isHorizontal} />}
      <Pill label={labels[0]} style={{ left: MARGIN, top: MARGIN }} />
      {second && <Pill label={labels[1]} style={second} />}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: PAD,
          bottom: PAD - 10,
          fontSize: 52,
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 0 12px rgba(0, 0, 0, 0.45)',
        }}
      >
        <span>{name}</span>
        <span style={{ color: GOLD }}>{product}</span>
        <span>{tld}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          right: PAD,
          bottom: PAD - 4,
          fontSize: 19,
          color: 'rgba(255, 255, 255, 0.6)',
        }}
      >
        {credit}
      </div>
    </div>
  );
}

async function renderOverlay(scene: OgScene, split: number | null, locale: Locale) {
  const t = MESSAGES[locale];
  const element = (
    <Overlay
      labels={scene.years.map((y) => t.years[y].label)}
      split={split}
      isHorizontal={scene.isHorizontal}
      credit={t.share.credit}
    />
  );
  const fonts = await loadFonts().catch(() => undefined);
  return Buffer.from(await new ImageResponse(element, { width: W, height: H, fonts }).arrayBuffer());
}

async function renderOgImage(scene: OgScene, locale: Locale) {
  const bbox = cameraBBox(scene);
  const feather = featherPx(scene.camera.zoom);
  const split = scene.years.length === 2 ? (scene.isHorizontal ? H : W) / 2 : null;
  const [panels, overlay] = await Promise.all([
    Promise.all(scene.years.map((year) => renderPanel(year, bbox, feather))),
    renderOverlay(scene, split, locale),
  ]);
  const layers: OverlayOptions[] = [];
  if (split !== null) {
    const rect = secondRect(split, scene.isHorizontal);
    layers.push({ input: await sharp(panels[1]).extract(rect).toBuffer(), left: rect.left, top: rect.top });
  }
  layers.push({ input: overlay });
  return sharp(panels[0]).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get('lang') ?? DEFAULT_LOCALE;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  try {
    const jpeg = await renderOgImage(readOgScene(searchParams.toString()), locale);
    return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE } });
  } catch (error) {
    console.warn('[og] falling back to the default image', error);
    return NextResponse.redirect(new URL(FALLBACK_IMAGE, request.url), {
      status: 307,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  }
}
