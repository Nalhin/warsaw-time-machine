import { BufferTarget, CanvasSource, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_MEDIUM } from 'mediabunny';

import { SITE_DOMAIN_PARTS } from './site';
import { fetchLabelImage, fetchYearImage, whiteToAlpha, type BBox } from './wms';
import { project } from './wms-request';
import { featherPx, yearDef, type YearKey } from './years';

export type Format = 'screen' | 'square' | 'portrait' | 'landscape';
export type Layout = 'split' | 'side' | 'stack';

export const LAYOUTS: Layout[] = ['split', 'side', 'stack'];

const SCREEN_LONG_SIDE = 1600;

export interface FormatSize {
  key: Format;
  width: number;
  height: number;
}

export const FORMATS: FormatSize[] = [
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

interface MediaOptions {
  format: Format;
  area: SnapshotArea;
  hasLabels: boolean;
  credit: string;
}

export interface SnapshotOptions extends MediaOptions {
  years: [YearKey] | [YearKey, YearKey];
  yearLabels: string[];
  layout: Layout;
  divider: number;
  isHorizontal: boolean;
}

export interface TimelapseOptions extends MediaOptions {
  years: YearKey[];
  yearLabels: string[];
  holdMs: number;
  fadeMs: number;
}

export class VideoUnsupportedError extends Error {}

export function formatSize(format: Format, area: SnapshotArea) {
  if (format !== 'screen') return FORMATS.find((f) => f.key === format)!;
  const aspect = area.width / area.height;
  const even = (v: number) => Math.round(v / 2) * 2;
  return aspect >= 1
    ? { width: SCREEN_LONG_SIDE, height: even(SCREEN_LONG_SIDE / aspect) }
    : { width: even(SCREEN_LONG_SIDE * aspect), height: SCREEN_LONG_SIDE };
}

const BG = '#1a1b1e';
const PILL_BG = 'rgba(17, 18, 20, 0.84)';
const PILL_FG = '#f3efe7';
const GOLD = '#e3b667';

type Rect = [x: number, y: number, width: number, height: number];

function createCanvas(width: number, height: number) {
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

function renderPanel(year: YearKey, bbox: BBox, width: number, height: number, hasLabels: boolean, feather: number) {
  const key = [year, ...bbox.map((v) => v.toFixed(1)), width, height, hasLabels, feather.toFixed(1)].join('|');
  const cached = panelCache.get(key);
  if (cached) return cached;

  const job = (async () => {
    const [photo, names] = await Promise.all([
      fetchYearImage(year, bbox, width, height),
      hasLabels ? fetchLabelImage(bbox, width, height).catch(() => null) : null,
    ]);
    const c = createCanvas(width, height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    if (yearDef(year).whiteIsBlank) {
      const tmp = createCanvas(width, height);
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
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const ink = ctx.measureText(text);
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const w = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight + padX * 2;
  const left = align === 'left' ? x : x - w;
  ctx.fillStyle = PILL_BG;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = PILL_FG;
  ctx.fillText(text, left + padX + ink.actualBoundingBoxLeft, y + (h + cap) / 2);
}

function drawHandle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, isHorizontal: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  if (isHorizontal) ctx.rotate(Math.PI / 2);
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

async function setup(o: MediaOptions) {
  const { width: W, height: H } = formatSize(o.format, o.area);
  const s = Math.min(W, H) / 1080;
  const sans = fontFamily('--font-inter', "'Inter var', ui-sans-serif, system-ui, sans-serif");
  await Promise.all([
    document.fonts.load(`400 24px ${sans}`),
    document.fonts.load(`600 24px ${sans}`),
    document.fonts.load(`700 24px ${sans}`),
  ]).catch(() => undefined);
  const out = createCanvas(W, H);
  return { W, H, s, sans, out, ctx: out.getContext('2d')! };
}

function fullPanel(o: MediaOptions, year: YearKey, W: number, H: number) {
  return areaPanel(o, year, [0, 0, W, H]);
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, baseline: number, s: number, sans: string) {
  const [name, product, tld] = SITE_DOMAIN_PARTS;
  const parts = [
    { text: name, font: `700 ${28 * s}px ${sans}`, color: '#fff' },
    { text: product, font: `700 ${28 * s}px ${sans}`, color: GOLD },
    { text: tld, font: `700 ${28 * s}px ${sans}`, color: '#fff' },
  ];
  let left = x;
  ctx.textAlign = 'left';
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 12 * s;
  for (const { text, font, color } of parts) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, left, baseline);
    left += ctx.measureText(text).width;
  }
  ctx.restore();
  return left - x;
}

function drawFooter(ctx: CanvasRenderingContext2D, o: MediaOptions, W: number, H: number, s: number, sans: string) {
  const shadeTop = H * 0.72;
  const shade = ctx.createLinearGradient(0, shadeTop, 0, H);
  shade.addColorStop(0, 'rgba(10, 10, 12, 0)');
  shade.addColorStop(1, 'rgba(10, 10, 12, 0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, shadeTop, W, H - shadeTop);

  const pad = 44 * s;
  const baseline = H - pad;
  ctx.textBaseline = 'alphabetic';
  const markWidth = drawWordmark(ctx, pad, baseline, s, sans);

  ctx.font = `400 ${17 * s}px ${sans}`;
  const doesCreditFit = markWidth + ctx.measureText(o.credit).width + 32 * s <= W - pad * 2;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(o.credit, W - pad, doesCreditFit ? baseline : baseline - 40 * s);
}

function apartRects(W: number, H: number, isStacked: boolean): [Rect, Rect] {
  const half = Math.round((isStacked ? H : W) / 2);
  return isStacked
    ? [
        [0, 0, W, half],
        [0, half, W, H - half],
      ]
    : [
        [0, 0, half, H],
        [half, 0, W - half, H],
      ];
}

function areaPanel(o: MediaOptions, year: YearKey, [, , w, h]: Rect) {
  const bbox = fit(o.area, w, h);
  const feather = featherPx(o.area.zoom) * (o.area.metersPerPixel / ((bbox[2] - bbox[0]) / w));
  return renderPanel(year, bbox, w, h, o.hasLabels, feather);
}

export async function renderSnapshot(o: SnapshotOptions): Promise<HTMLCanvasElement> {
  const { W, H, s, sans, out, ctx } = await setup(o);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const margin = 28 * s;
  const line = Math.max(2, Math.round(3 * s));

  if (o.years.length === 1) {
    ctx.drawImage(await fullPanel(o, o.years[0], W, H), 0, 0);
    drawFooter(ctx, o, W, H, s, sans);
    ctx.font = `600 ${26 * s}px ${sans}`;
    pill(ctx, o.yearLabels[0], margin, margin, s, 'left');
    return out;
  }

  if (o.layout !== 'split') {
    const isStacked = o.layout === 'stack';
    const rects = apartRects(W, H, isStacked);
    const panels = await Promise.all(o.years.map((year, i) => areaPanel(o, year, rects[i])));
    panels.forEach((p, i) => ctx.drawImage(p, rects[i][0], rects[i][1]));
    drawFooter(ctx, o, W, H, s, sans);
    ctx.fillStyle = '#fff';
    if (isStacked) ctx.fillRect(0, rects[1][1] - line / 2, W, line);
    else ctx.fillRect(rects[1][0] - line / 2, 0, line, H);
    ctx.font = `600 ${26 * s}px ${sans}`;
    rects.forEach(([x, y], i) => pill(ctx, o.yearLabels[i], x + margin, y + margin, s, 'left'));
    return out;
  }

  const panels = await Promise.all(o.years.map((year) => fullPanel(o, year, W, H)));
  const full = fit(o.area, W, H);
  const along = o.isHorizontal
    ? (full[3] - (o.area.cy + o.area.height / 2 - o.divider * o.area.height)) / (full[3] - full[1])
    : (o.area.cx - o.area.width / 2 + o.divider * o.area.width - full[0]) / (full[2] - full[0]);
  const split = Math.round((o.isHorizontal ? H : W) * Math.min(0.97, Math.max(0.03, along)));
  if (o.isHorizontal) {
    ctx.drawImage(panels[0], 0, 0, W, split, 0, 0, W, split);
    ctx.drawImage(panels[1], 0, split, W, H - split, 0, split, W, H - split);
  } else {
    ctx.drawImage(panels[0], 0, 0, split, H, 0, 0, split, H);
    ctx.drawImage(panels[1], split, 0, W - split, H, split, 0, W - split, H);
  }

  drawFooter(ctx, o, W, H, s, sans);
  ctx.fillStyle = '#fff';
  if (o.isHorizontal) ctx.fillRect(0, split - line / 2, W, line);
  else ctx.fillRect(split - line / 2, 0, line, H);
  if (o.isHorizontal) drawHandle(ctx, W / 2, split, s, true);
  else drawHandle(ctx, split, H / 2, s, false);

  ctx.font = `600 ${26 * s}px ${sans}`;
  const [a, b] = o.yearLabels;
  pill(ctx, a, margin, margin, s, 'left');
  if (o.isHorizontal) pill(ctx, b, margin, split + margin, s, 'left');
  else pill(ctx, b, W - margin, margin, s, 'right');
  return out;
}

const FPS = 30;
const LOOKAHEAD = 3;

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export async function renderTimelapse(o: TimelapseOptions, onProgress: (done: number) => void, signal: AbortSignal): Promise<Blob> {
  const { W, H, s, sans, out, ctx } = await setup(o);
  const codec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H, quality: QUALITY_MEDIUM });
  if (!codec) throw new VideoUnsupportedError();

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(out, { codec, quality: QUALITY_MEDIUM });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const jobs: (Promise<HTMLCanvasElement> | undefined)[] = [];
  const panel = (i: number) => (jobs[i] ??= fullPanel(o, o.years[i], W, H));
  const hold = o.holdMs / 1000;
  const fadeFrames = Math.round(Math.min(o.fadeMs / 1000, hold) * FPS);
  const frames = o.years.flatMap((_, i) => {
    const fades = i > 0 ? Array.from({ length: fadeFrames }, (_, f) => ({ i, mix: ease((f + 1) / (fadeFrames + 1)), duration: 1 / FPS })) : [];
    const still = hold - fades.length / FPS + (i === o.years.length - 1 ? hold : 0);
    return [...fades, { i, mix: 1, duration: still }];
  });
  const margin = 28 * s;

  try {
    let timestamp = 0;
    for (const [n, { i, mix, duration }] of frames.entries()) {
      if (signal.aborted) throw signal.reason;
      for (let k = i; k <= Math.min(o.years.length - 1, i + LOOKAHEAD); k++) panel(k);
      jobs[i - 2] = undefined;
      const [current, previous] = await Promise.all([panel(i), mix < 1 ? panel(i - 1) : null]);

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      if (previous) ctx.drawImage(previous, 0, 0);
      ctx.globalAlpha = mix;
      ctx.drawImage(current, 0, 0);
      ctx.globalAlpha = 1;
      drawFooter(ctx, o, W, H, s, sans);
      ctx.font = `600 ${26 * s}px ${sans}`;
      pill(ctx, o.yearLabels[mix < 0.5 ? i - 1 : i], margin, margin, s, 'left');

      await source.add(timestamp, duration);
      timestamp += duration;
      onProgress((n + 1) / frames.length);
    }
    source.close();
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}

export function toBlob(c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, quality),
  );
}
