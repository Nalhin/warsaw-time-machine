import { fetchLabelImage, fetchYearImage, whiteToAlpha, type BBox } from './wms';
import { featherPx, yearDef, type YearKey } from './years';

export type Layout = 'side' | 'stack' | 'split';
export type Format = 'screen' | 'square' | 'portrait' | 'landscape';

export const LAYOUTS: Layout[] = ['side', 'stack', 'split'];

const SCREEN_LONG_SIDE = 1600;

export const FORMATS: { key: Format; width: number; height: number }[] = [
  { key: 'screen', width: 0, height: 0 },
  { key: 'square', width: 1080, height: 1080 },
  { key: 'portrait', width: 1080, height: 1350 },
  { key: 'landscape', width: 1600, height: 900 },
];

export interface SnapshotArea {
  cx: number;
  cy: number;
  width: number;
  height: number;
  zoom: number;
  metersPerPixel: number;
}

export interface SnapshotOptions {
  years: [YearKey, YearKey];
  layout: Layout;
  format: Format;
  area: SnapshotArea;
  divider: number;
  horizontal: boolean;
  labels: boolean;
  title: string;
  host: string;
  yearLabels: [string, string];
  credit: string;
}

export function formatSize(format: Format, area: SnapshotArea) {
  if (format !== 'screen') return FORMATS.find((f) => f.key === format)!;
  const aspect = area.width / area.height;
  return aspect >= 1
    ? { width: SCREEN_LONG_SIDE, height: Math.round(SCREEN_LONG_SIDE / aspect) }
    : { width: Math.round(SCREEN_LONG_SIDE * aspect), height: SCREEN_LONG_SIDE };
}

const BG = '#1a1b1e';
const PILL_BG = 'rgba(17, 18, 20, 0.84)';
const PILL_FG = '#f3efe7';
const EARTH_RADIUS = 6378137;

const project = (lat: number, lng: number): [number, number] => [
  (EARTH_RADIUS * lng * Math.PI) / 180,
  EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function fit(area: SnapshotArea, width: number, height: number): BBox {
  const aspect = width / height;
  const w = area.width / area.height > aspect ? area.height * aspect : area.width;
  const h = w / aspect;
  return [area.cx - w / 2, area.cy - h / 2, area.cx + w / 2, area.cy + h / 2];
}

function drawCoverageMask(ctx: CanvasRenderingContext2D, year: YearKey, bbox: BBox, width: number, height: number, feather: number) {
  const scale = width / (bbox[2] - bbox[0]);
  const pad = feather * 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pad, -pad, width + pad * 2, height + pad * 2);
  for (const ring of yearDef(year).outline) {
    ring.forEach(([lat, lng], i) => {
      const [x, y] = project(lat, lng);
      const px = (x - bbox[0]) * scale;
      const py = (bbox[3] - y) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
  ctx.filter = `blur(${feather}px)`;
  ctx.fillStyle = BG;
  ctx.strokeStyle = BG;
  ctx.lineWidth = feather * 4;
  ctx.lineJoin = 'round';
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.restore();
}

const panelCache = new Map<string, Promise<HTMLCanvasElement>>();

function renderPanel(year: YearKey, bbox: BBox, width: number, height: number, labels: boolean, feather: number) {
  const key = [year, ...bbox.map((v) => v.toFixed(1)), width, height, labels, feather.toFixed(1)].join('|');
  const cached = panelCache.get(key);
  if (cached) return cached;

  const job = (async () => {
    const [photo, names] = await Promise.all([
      fetchYearImage(year, bbox, width, height),
      labels ? fetchLabelImage(bbox, width, height).catch(() => null) : null,
    ]);
    const c = canvas(width, height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    if (yearDef(year).whiteIsBlank) {
      const tmp = canvas(width, height);
      whiteToAlpha(tmp, photo);
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.drawImage(photo, 0, 0, width, height);
    }
    drawCoverageMask(ctx, year, bbox, width, height, feather);
    if (names) ctx.drawImage(names, 0, 0, width, height);
    return c;
  })();

  panelCache.set(key, job);
  job.catch(() => panelCache.delete(key));
  while (panelCache.size > 16) panelCache.delete(panelCache.keys().next().value!);
  return job;
}

function fontFamily(variable: string, fallback: string) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return family ? `${family}, ${fallback}` : fallback;
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, align: 'left' | 'right') {
  const padX = 16 * s;
  const h = 46 * s;
  const w = ctx.measureText(text).width + padX * 2;
  const left = align === 'left' ? x : x - w;
  ctx.fillStyle = PILL_BG;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = PILL_FG;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + padX, y + h / 2 + s);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines = [''];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = `${lines[lines.length - 1]} ${word}`.trim();
    if (ctx.measureText(trial).width <= maxWidth || !lines[lines.length - 1]) lines[lines.length - 1] = trial;
    else lines.push(word);
  }
  return lines;
}

function drawHandle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, horizontal: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  if (horizontal) ctx.rotate(Math.PI / 2);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 14 * s;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 28 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#18181b';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 16 * s, 0);
    ctx.lineTo(dir * 6 * s, -9 * s);
    ctx.lineTo(dir * 6 * s, 9 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export async function renderSnapshot(o: SnapshotOptions): Promise<HTMLCanvasElement> {
  const { width: W, height: H } = formatSize(o.format, o.area);
  const s = Math.min(W, H) / 1080;
  const heading = fontFamily('--font-fraunces', 'Georgia, serif');
  const sans = fontFamily('--font-geist', 'system-ui, sans-serif');
  await Promise.all([
    document.fonts.load(`600 64px ${heading}`),
    document.fonts.load(`600 24px ${sans}`),
    document.fonts.load(`500 24px ${sans}`),
  ]).catch(() => undefined);

  const rects: [number, number, number, number][] =
    o.layout === 'side'
      ? [
          [0, 0, Math.round(W / 2), H],
          [Math.round(W / 2), 0, W - Math.round(W / 2), H],
        ]
      : o.layout === 'stack'
        ? [
            [0, 0, W, Math.round(H / 2)],
            [0, Math.round(H / 2), W, H - Math.round(H / 2)],
          ]
        : [
            [0, 0, W, H],
            [0, 0, W, H],
          ];

  const panels = await Promise.all(
    o.years.map((year, i) => {
      const [, , w, h] = rects[i];
      const bbox = fit(o.area, w, h);
      const outMpp = (bbox[2] - bbox[0]) / w;
      const feather = featherPx(o.area.zoom) * (o.area.metersPerPixel / outMpp);
      return renderPanel(year, bbox, w, h, o.labels, feather);
    }),
  );

  const out = canvas(W, H);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const full = fit(o.area, W, H);
  const along = o.horizontal
    ? (full[3] - (o.area.cy + o.area.height / 2 - o.divider * o.area.height)) / (full[3] - full[1])
    : (o.area.cx - o.area.width / 2 + o.divider * o.area.width - full[0]) / (full[2] - full[0]);
  const split = Math.round((o.horizontal ? H : W) * Math.min(0.97, Math.max(0.03, along)));
  if (o.layout === 'split' && o.horizontal) {
    ctx.drawImage(panels[0], 0, 0, W, split, 0, 0, W, split);
    ctx.drawImage(panels[1], 0, split, W, H - split, 0, split, W, H - split);
  } else if (o.layout === 'split') {
    ctx.drawImage(panels[0], 0, 0, split, H, 0, 0, split, H);
    ctx.drawImage(panels[1], split, 0, W - split, H, split, 0, W - split, H);
  } else {
    panels.forEach((p, i) => ctx.drawImage(p, rects[i][0], rects[i][1]));
  }

  const shadeTop = H * (o.title.trim() ? 0.6 : 0.72);
  const shade = ctx.createLinearGradient(0, shadeTop, 0, H);
  shade.addColorStop(0, 'rgba(10, 10, 12, 0)');
  shade.addColorStop(1, 'rgba(10, 10, 12, 0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, shadeTop, W, H - shadeTop);

  ctx.fillStyle = '#fff';
  const line = Math.max(2, Math.round(3 * s));
  if (o.layout === 'stack') ctx.fillRect(0, rects[1][1] - line / 2, W, line);
  else if (o.layout === 'side') ctx.fillRect(rects[1][0] - line / 2, 0, line, H);
  else if (o.horizontal) ctx.fillRect(0, split - line / 2, W, line);
  else ctx.fillRect(split - line / 2, 0, line, H);
  if (o.layout === 'split') {
    if (o.horizontal) drawHandle(ctx, W / 2, split, s, true);
    else drawHandle(ctx, split, H / 2, s, false);
  }

  const margin = 28 * s;
  ctx.font = `600 ${26 * s}px ${sans}`;
  const [a, b] = o.yearLabels;
  if (o.layout === 'split' && o.horizontal) {
    pill(ctx, a, margin, margin, s, 'left');
    pill(ctx, b, margin, split + margin, s, 'left');
  } else if (o.layout === 'split') {
    pill(ctx, a, margin, margin, s, 'left');
    pill(ctx, b, W - margin, margin, s, 'right');
  } else {
    pill(ctx, a, rects[0][0] + margin, rects[0][1] + margin, s, 'left');
    pill(ctx, b, rects[1][0] + margin, rects[1][1] + margin, s, 'left');
  }

  const pad = 44 * s;
  let baseline = H - pad;
  ctx.textBaseline = 'alphabetic';

  ctx.font = `400 ${17 * s}px ${sans}`;
  const credit = o.credit;
  const creditWidth = ctx.measureText(credit).width;

  ctx.font = `600 ${26 * s}px ${sans}`;
  const hostWidth = ctx.measureText(o.host).width;

  ctx.textAlign = 'right';
  ctx.font = `400 ${17 * s}px ${sans}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  const creditFits = hostWidth + creditWidth + 32 * s <= W - pad * 2;
  ctx.fillText(credit, W - pad, creditFits ? baseline : baseline - 34 * s);

  ctx.textAlign = 'left';
  ctx.font = `600 ${26 * s}px ${sans}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(o.host, pad, baseline);

  const title = o.title.trim();
  if (title) {
    baseline -= 26 * s + 24 * s;
    const maxWidth = W - pad * 2;
    let size = 68 * s;
    let lines: string[] = [];
    for (; size >= 44 * s; size -= 4 * s) {
      ctx.font = `600 ${size}px ${heading}`;
      lines = wrap(ctx, title, maxWidth);
      if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) break;
    }
    lines = lines.slice(0, 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18 * s;
    lines
      .slice()
      .reverse()
      .forEach((l, i) => ctx.fillText(l, pad, baseline - i * size * 1.08));
    ctx.shadowBlur = 0;
  }

  return out;
}

export function toBlob(c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, quality),
  );
}
