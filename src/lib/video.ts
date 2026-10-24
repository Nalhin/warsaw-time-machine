import { drawHandle, fit, fontFamily, renderPanel, type SnapshotArea } from './snapshot';
import { covers, featherPx, YEAR_KEYS, type YearKey } from './years';

export type VideoKind = 'timelapse' | 'swipe';
export type Sequence = 'short' | 'full' | 'custom';
export type VideoFormat = 'story' | 'portrait' | 'square' | 'landscape';

export const VIDEO_KINDS: VideoKind[] = ['timelapse', 'swipe'];
export const SEQUENCES: Sequence[] = ['short', 'full', 'custom'];

export const PRESETS: Record<Exclude<Sequence, 'custom'>, YearKey[]> = {
  short: ['1935', '1945', 'today'],
  full: ['1935', '1945', '1951', '1972', '1987', '1997', '2008', '2016', 'today'],
};

export const VIDEO_FORMATS: { key: VideoFormat; width: number; height: number }[] = [
  { key: 'story', width: 1080, height: 1920 },
  { key: 'portrait', width: 1080, height: 1350 },
  { key: 'square', width: 1080, height: 1080 },
  { key: 'landscape', width: 1920, height: 1080 },
];

const FPS = 30;
const BITRATE = 8_000_000;
const END_HOLD = 1800;
const PUSH_IN = 0.08;
const MAX_FRAME_GAP = 1000;
const LOAD_CONCURRENCY = 3;
const MANY_YEARS = 12;
const EARTH_RADIUS = 6378137;
const SWIPE = { holdA: 1200, sweep: 3600, holdB: 1000, back: 1800 };

const MIME_TYPES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function videoMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export class InterruptedError extends Error {}

export interface VideoOptions {
  kind: VideoKind;
  years: YearKey[];
  format: VideoFormat;
  area: SnapshotArea;
  labels: boolean;
  host: string;
  credit: string;
  yearLabel(key: YearKey): string;
}

export interface Video {
  options: VideoOptions;
  panels: HTMLCanvasElement[];
  width: number;
  height: number;
  duration: number;
  hold: number;
  fade: number;
  fonts: { sans: string };
}

function centerLatLng(area: SnapshotArea): [number, number] {
  const lng = (area.cx / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(area.cy / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lat, lng];
}

export function coveredYears(area: SnapshotArea): Set<YearKey> {
  const [lat, lng] = centerLatLng(area);
  return new Set(YEAR_KEYS.filter((k) => covers(k, lat, lng)));
}

export function formatSize(format: VideoFormat) {
  return VIDEO_FORMATS.find((f) => f.key === format)!;
}

function timing(count: number) {
  const step = Math.min(3400, Math.max(700, 12500 / count));
  const fade = Math.min(800, step * 0.32);
  return { hold: step - fade, fade };
}

export async function prepareVideo(
  options: VideoOptions,
  signal: AbortSignal,
  onLoaded: (done: number, total: number) => void,
): Promise<Video | null> {
  const { years } = options;
  if (years.length < 2) return null;
  const size = formatSize(options.format);
  const scale = years.length > MANY_YEARS ? 2 / 3 : 1;
  const W = Math.round((size.width * scale) / 2) * 2;
  const H = Math.round((size.height * scale) / 2) * 2;
  const bbox = fit(options.area, W, H);
  const feather = featherPx(options.area.zoom) * (options.area.metersPerPixel / ((bbox[2] - bbox[0]) / W));
  const sans = fontFamily('--font-inter', "'Inter var', ui-sans-serif, system-ui, sans-serif");

  const panels: HTMLCanvasElement[] = new Array(years.length);
  let done = 0;
  let next = 0;
  onLoaded(0, years.length);
  const worker = async () => {
    while (next < years.length) {
      const i = next++;
      panels[i] = await renderPanel(years[i], bbox, W, H, options.labels, feather, 'jpeg');
      if (signal.aborted) throw signal.reason;
      onLoaded(++done, years.length);
    }
  };
  await Promise.all([
    ...Array.from({ length: LOAD_CONCURRENCY }, worker),
    document.fonts.load(`700 200px ${sans}`),
    document.fonts.load(`600 40px ${sans}`),
  ]);

  const { hold, fade } = timing(years.length);
  const duration =
    options.kind === 'swipe'
      ? SWIPE.holdA + SWIPE.sweep + SWIPE.holdB + SWIPE.back + END_HOLD
      : years.length * hold + (years.length - 1) * fade + END_HOLD;
  return { options, panels, width: W, height: H, duration, hold, fade, fonts: { sans } };
}

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) ctx.font = `${weight} ${Math.floor((size * maxWidth) / width)}px ${family}`;
}

function yearMetrics(v: Video) {
  const s = Math.min(v.width, v.height) / 1080;
  const size = 230 * s;
  return { s, size, baseline: Math.max(v.height * 0.21, 110 * s + size * 0.75), margin: 64 * s };
}

function drawPanels(ctx: CanvasRenderingContext2D, v: Video, time: number, draw: () => void) {
  const zoom = 1 + PUSH_IN * clamp01(time / v.duration);
  ctx.save();
  ctx.translate(v.width / 2, v.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-v.width / 2, -v.height / 2);
  draw();
  ctx.restore();
}

function drawYear(ctx: CanvasRenderingContext2D, v: Video, label: string, cx: number, maxWidth: number, alpha: number) {
  const { size, baseline } = yearMetrics(v);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 24 * (size / 230);
  ctx.fillStyle = '#fff';
  fitFont(ctx, label, 700, size, v.fonts.sans, maxWidth);
  ctx.fillText(label, cx, baseline);
  ctx.restore();
}

function drawShade(ctx: CanvasRenderingContext2D, v: Video) {
  const { width: W, height: H } = v;
  const { s, baseline } = yearMetrics(v);
  const topEnd = Math.max(H * 0.36, baseline + 120 * s);
  const top = ctx.createLinearGradient(0, 0, 0, topEnd);
  top.addColorStop(0, 'rgba(10, 10, 12, 0.72)');
  top.addColorStop(1, 'rgba(10, 10, 12, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, topEnd);
  const bottomStart = H - Math.max(H * 0.2, 260 * s);
  const bottom = ctx.createLinearGradient(0, bottomStart, 0, H);
  bottom.addColorStop(0, 'rgba(10, 10, 12, 0)');
  bottom.addColorStop(1, 'rgba(10, 10, 12, 0.7)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, bottomStart, W, H - bottomStart);
}

function drawBranding(ctx: CanvasRenderingContext2D, v: Video, time: number) {
  const { width: W, height: H, options, fonts } = v;
  const { s, margin } = yearMetrics(v);
  const outro = clamp01((time - (v.duration - END_HOLD + 300)) / 500);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12 * s;
  ctx.textAlign = 'left';
  ctx.font = `400 ${24 * s}px ${fonts.sans}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText(options.credit, margin, H - 72 * s);
  ctx.textAlign = 'right';
  ctx.font = `600 ${34 * s}px ${fonts.sans}`;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.92 * (1 - outro)})`;
  ctx.fillText(options.host, W - margin, H - 70 * s);
  ctx.restore();

  if (outro <= 0) return;
  ctx.save();
  ctx.globalAlpha = outro;
  ctx.font = `600 ${60 * s}px ${fonts.sans}`;
  const w = ctx.measureText(options.host).width + 96 * s;
  const h = 112 * s;
  const y = H * 0.64;
  ctx.fillStyle = 'rgba(17, 18, 20, 0.84)';
  ctx.beginPath();
  ctx.roundRect((W - w) / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#f3efe7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(options.host, W / 2, y + 3 * s);
  ctx.restore();
}

function drawTimelapse(ctx: CanvasRenderingContext2D, v: Video, time: number) {
  const { years } = v.options;
  const step = v.hold + v.fade;
  const i = Math.min(years.length - 1, Math.floor(time / step));
  const local = time - i * step;
  const mix = i < years.length - 1 && local > v.hold ? ease(Math.min(1, (local - v.hold) / v.fade)) : 0;

  drawPanels(ctx, v, time, () => {
    ctx.drawImage(v.panels[i], 0, 0);
    if (mix > 0) {
      ctx.globalAlpha = mix;
      ctx.drawImage(v.panels[i + 1], 0, 0);
    }
  });
  drawShade(ctx, v);
  const { margin } = yearMetrics(v);
  const label = v.options.yearLabel(mix < 0.5 ? years[i] : years[i + 1]);
  drawYear(ctx, v, label, v.width / 2, v.width - margin * 2, mix > 0 ? Math.min(1, Math.abs(mix - 0.5) * 5) : 1);
}

function dividerAt(time: number) {
  let t = time;
  if (t < SWIPE.holdA) return 1;
  t -= SWIPE.holdA;
  if (t < SWIPE.sweep) return 1 - ease(t / SWIPE.sweep);
  t -= SWIPE.sweep;
  if (t < SWIPE.holdB) return 0;
  t -= SWIPE.holdB;
  if (t < SWIPE.back) return 0.5 * ease(t / SWIPE.back);
  return 0.5;
}

function drawSwipe(ctx: CanvasRenderingContext2D, v: Video, time: number) {
  const { width: W, height: H } = v;
  const [a, b] = v.options.years;
  const x = Math.round(W * dividerAt(time));

  drawPanels(ctx, v, time, () => ctx.drawImage(v.panels[1], 0, 0));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, x, H);
  ctx.clip();
  drawPanels(ctx, v, time, () => ctx.drawImage(v.panels[0], 0, 0));
  ctx.restore();
  drawShade(ctx, v);

  const { s, margin } = yearMetrics(v);
  for (const [key, from, to] of [
    [a, 0, x],
    [b, x, W],
  ] as const) {
    const width = to - from;
    const alpha = clamp01((width / W - 0.18) / 0.17);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(from, 0, width, H);
    ctx.clip();
    drawYear(ctx, v, v.options.yearLabel(key), (from + to) / 2, width - margin * 2, alpha);
    ctx.restore();
  }

  if (x > 0 && x < W) {
    const line = Math.max(2, Math.round(3 * s));
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - line / 2, 0, line, H);
    drawHandle(ctx, x, H / 2, s, false);
  }
}

export function drawVideoFrame(ctx: CanvasRenderingContext2D, v: Video, time: number) {
  ctx.fillStyle = '#1a1b1e';
  ctx.fillRect(0, 0, v.width, v.height);
  if (v.options.kind === 'swipe') drawSwipe(ctx, v, time);
  else drawTimelapse(ctx, v, time);
  drawBranding(ctx, v, time);
}

export async function recordVideo(
  canvas: HTMLCanvasElement,
  v: Video,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const mimeType = videoMimeType();
  if (!mimeType) throw new Error('Video recording is not supported');
  canvas.width = v.width;
  canvas.height = v.height;
  const ctx = canvas.getContext('2d')!;
  drawVideoFrame(ctx, v, 0);
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Recording failed'));
  });
  stopped.catch(() => undefined);
  recorder.start(1000);
  try {
    await new Promise<void>((resolve, reject) => {
      const start = performance.now();
      let last = start;
      const tick = (now: number) => {
        if (signal.aborted) return reject(signal.reason);
        if (now - last > MAX_FRAME_GAP) return reject(new InterruptedError('Recording was interrupted'));
        last = now;
        const time = Math.max(0, now - start);
        drawVideoFrame(ctx, v, Math.min(time, v.duration));
        onProgress(Math.min(1, time / v.duration));
        if (time >= v.duration + 150) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
  await stopped;
  return new Blob(chunks, { type: (recorder.mimeType || mimeType).split(';')[0] });
}
