'use client';

import type L from 'leaflet';
import { Check, Copy, Download, ImageIcon, Link2, Loader2, Share2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useMessages } from '@/components/locale-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Choice, Field } from '@/components/share-fields';
import { YearSelect } from '@/components/year-controls';
import { SITE_NAME } from '@/lib/site';
import {
  FORMATS,
  LAYOUTS,
  formatSize,
  renderSnapshot,
  renderTimelapse,
  toBlob,
  VideoUnsupportedError,
  type Format,
  type Layout,
  type SnapshotArea,
} from '@/lib/snapshot';
import {
  mapStateToQuery,
  PLAY_FADE_RATIO,
  PLAY_HOLD_MS,
  type MapState,
  type PlaybackSpeed,
  type Side,
  type SwipeYears,
  type ViewMode,
} from '@/lib/state';
import { cn } from '@/lib/utils';
import { coverageOverlap, MIN_OVERLAP, YEAR_KEYS, yearDef, type Box, type YearKey } from '@/lib/years';

type Mode = 'link' | 'media';
type RenderError = 'failed' | 'unsupported';

export interface Inset {
  right: number;
  bottom: number;
}

interface Capture {
  area: SnapshotArea;
  bounds: Box;
  divider: number;
  isHorizontal: boolean;
  kind: ViewMode;
  years: YearKey[];
  holdMs: number;
  link: string;
}

interface Result {
  canvas: HTMLCanvasElement | null;
  blob: Blob;
  url: string;
}

function capture(map: L.Map, state: MapState, ratio: number, speed: PlaybackSpeed, inset: Inset): Capture {
  const size = map.getSize();
  const width = Math.max(1, size.x - inset.right);
  const height = Math.max(1, size.y - inset.bottom);
  const crs = map.options.crs!;
  const nwLatLng = map.containerPointToLatLng([0, 0]);
  const seLatLng = map.containerPointToLatLng([width, height]);
  const nw = crs.project(nwLatLng);
  const se = crs.project(seLatLng);
  const c = map.getCenter();
  const camera = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
  const bounds: Box = [
    [seLatLng.lat, nwLatLng.lng],
    [nwLatLng.lat, seLatLng.lng],
  ];
  return {
    area: {
      cx: (nw.x + se.x) / 2,
      cy: (nw.y + se.y) / 2,
      width: se.x - nw.x,
      height: nw.y - se.y,
      zoom: map.getZoom(),
      metersPerPixel: (se.x - nw.x) / width,
    },
    bounds,
    divider: state.isHorizontal ? (ratio * size.y) / height : (ratio * size.x) / width,
    isHorizontal: state.mode === 'compare' && state.isHorizontal,
    kind: state.mode,
    years: state.mode === 'compare' ? state.swipe : state.mode === 'year' ? [state.year] : coveredYears(bounds),
    holdMs: PLAY_HOLD_MS / speed,
    link: `${location.origin}${location.pathname}${mapStateToQuery(state, camera)}`,
  };
}

function coveredYears(bounds: Box) {
  const covered = YEAR_KEYS.filter((k) => coverageOverlap(bounds, yearDef(k).coverage) >= MIN_OVERLAP);
  return covered.length ? covered : [...YEAR_KEYS];
}

function timelapseYears(covered: YearKey[], [from, to]: SwipeYears) {
  const span = YEAR_KEYS.slice(YEAR_KEYS.indexOf(from), YEAR_KEYS.indexOf(to) + 1);
  const picked = covered.filter((y) => span.includes(y));
  return picked.length ? picked : span;
}

function setRangeSide(range: SwipeYears, side: Side, year: YearKey): SwipeYears {
  const next: SwipeYears = [...range];
  next[side] = year;
  return YEAR_KEYS.indexOf(next[0]) > YEAR_KEYS.indexOf(next[1]) ? [next[1], next[0]] : next;
}

function supportsFileShare(name: string, type: string) {
  try {
    return !!navigator.canShare?.({ files: [new File([''], name, { type })] });
  } catch {
    return false;
  }
}

interface ShareDialogProps {
  map: L.Map;
  state: MapState;
  ratio: number;
  speed: PlaybackSpeed;
  showLabels: boolean;
  inset: Inset;
}

export function ShareDialog({ map, state, ratio, speed, showLabels, inset }: ShareDialogProps) {
  const t = useMessages();
  const m = t.share;
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('link');
  const [snap, setSnap] = useState<Capture | null>(null);
  const [range, setRange] = useState<SwipeYears>([YEAR_KEYS[0], 'today']);
  const [layout, setLayout] = useState<Layout>('split');
  const [format, setFormat] = useState<Format>('screen');
  const [hasLabels, setHasLabels] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<RenderError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [canShareImage, setCanShareImage] = useState(false);
  const [canShareVideo, setCanShareVideo] = useState(false);
  const [canShareLink, setCanShareLink] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const resultRef = useRef<Result | null>(null);

  useEffect(() => {
    setCanShareImage(supportsFileShare('x.jpg', 'image/jpeg'));
    setCanShareVideo(supportsFileShare('x.mp4', 'video/mp4'));
    setCanShareLink(!!navigator.share);
    setCanCopyImage(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write);
  }, []);

  const replaceResult = (next: Result | null) => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = next;
    setResult(next);
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      const captured = capture(map, state, ratio, speed, inset);
      setSnap(captured);
      if (captured.kind === 'timelapse') setRange([captured.years[0], captured.years[captured.years.length - 1]]);
      setHasLabels(showLabels);
      setIsCopied(false);
      setMode('link');
      replaceResult(null);
    }
    setIsOpen(next);
  };

  const kind = snap?.kind ?? state.mode;
  const isVideo = kind === 'timelapse';

  useEffect(() => {
    if (!isOpen || !snap || mode !== 'media') return;
    const controller = new AbortController();
    const isAborted = () => controller.signal.aborted;
    setIsBusy(true);
    setError(null);
    setProgress(null);
    const base = { format, area: snap.area, hasLabels, credit: m.credit };
    const shown = snap.kind === 'timelapse' ? timelapseYears(snap.years, range) : snap.years;
    const yearLabels = shown.map((y) => t.years[y].label);
    const timer = setTimeout(async () => {
      try {
        let next: Omit<Result, 'url'>;
        if (snap.kind === 'timelapse') {
          setProgress(0);
          const blob = await renderTimelapse(
            { ...base, years: shown, yearLabels, holdMs: snap.holdMs, fadeMs: snap.holdMs * PLAY_FADE_RATIO },
            (done) => !isAborted() && setProgress(Math.floor(done * 100)),
            controller.signal,
          );
          next = { blob, canvas: null };
        } else {
          const canvas = await renderSnapshot({
            ...base,
            years: shown as [YearKey] | SwipeYears,
            yearLabels,
            layout,
            divider: snap.divider,
            isHorizontal: snap.isHorizontal,
          });
          next = { blob: await toBlob(canvas), canvas };
        }
        if (isAborted()) return;
        replaceResult({ ...next, url: URL.createObjectURL(next.blob) });
      } catch (e) {
        if (isAborted()) return;
        console.error('[share] render failed', e);
        setError(e instanceof VideoUnsupportedError ? 'unsupported' : 'failed');
      } finally {
        if (!isAborted()) {
          setIsBusy(false);
          setProgress(null);
        }
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [isOpen, snap, mode, range, layout, format, hasLabels, attempt, t]);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    },
    [],
  );

  const videoYears = snap && isVideo ? timelapseYears(snap.years, range) : [];
  const videoSeconds = snap ? Math.round(((videoYears.length + 1) * snap.holdMs) / 1000) : 0;
  const fileName = isVideo
    ? `${m.filePrefix}-${range.join('-')}.mp4`
    : `${m.filePrefix}-${(snap?.years ?? []).join('-vs-')}.jpg`;
  const isReady = !!result && !isBusy && !error;
  const canShareFiles = isVideo ? canShareVideo : canShareImage;
  const preview = snap ? formatSize(format, snap.area) : { width: 1, height: 1 };

  const copyLink = async () => {
    if (!snap) return;
    try {
      await navigator.clipboard.writeText(snap.link);
      setIsCopied(true);
      toast.success(m.linkCopied);
    } catch {
      toast.error(m.linkFailed);
    }
  };

  const shareLink = async () => {
    if (!snap) return;
    try {
      await navigator.share({ title: SITE_NAME, url: snap.link });
    } catch {
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = fileName;
    a.click();
  };

  const copyImage = async () => {
    if (!result?.canvas) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(result.canvas, 'image/png') })]);
      toast.success(m.imageCopied);
    } catch {
      toast.error(m.imageCopyFailed);
    }
  };

  const shareMedia = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: [new File([result.blob], fileName, { type: result.blob.type })], title: SITE_NAME });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(isVideo ? m.videoShareFailed : m.imageShareFailed);
    }
  };

  const heading = mode === 'link' ? [m.title, m.description] : [m.mediaTitle[kind], m.mediaDescription[kind]];
  const previewClass = cn('size-full object-contain transition-opacity', isBusy && 'opacity-50');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button className="h-[42px] gap-1.5 rounded-full bg-gold px-3.5 text-[0.8rem] font-semibold text-gold-foreground shadow-lg hover:bg-gold/85 [&_svg:not([class*='size-'])]:size-3.5">
              <Share2 />
              {m.trigger}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{m.title}</TooltipContent>
      </Tooltip>

      <DialogContent className={cn('max-h-[calc(100dvh-32px)] overflow-y-auto', mode === 'link' ? 'sm:max-w-md' : 'sm:max-w-3xl')}>
        <DialogHeader>
          <DialogTitle>{heading[0]}</DialogTitle>
          <DialogDescription>{heading[1]}</DialogDescription>
        </DialogHeader>

        <div className="sm:max-w-60">
          <Choice<Mode>
            value={mode}
            onChange={setMode}
            options={(['link', 'media'] as const).map((key) => ({ key, label: m.modes[key] }))}
            label={m.title}
          />
        </div>

        {mode === 'link' ? (
          <div className="grid gap-3">
            <input
              readOnly
              value={snap?.link ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={m.link}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-input/30 px-3 text-sm text-muted-foreground outline-none focus-visible:border-ring"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={copyLink}>
                {isCopied ? <Check /> : <Link2 />}
                {isCopied ? m.copied : m.copyLink}
              </Button>
              {canShareLink && (
                <Button variant="outline" className="flex-1" onClick={shareLink}>
                  <Share2 />
                  {m.shareLink}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid content-start gap-3">
              <div
                className="relative mx-auto w-full overflow-hidden rounded-lg bg-[#1a1b1e] ring-1 ring-foreground/10"
                style={{ aspectRatio: `${preview.width} / ${preview.height}`, maxHeight: '58dvh', maxWidth: `calc(58dvh * ${preview.width / preview.height})` }}
              >
                {result &&
                  (result.canvas ? (
                    <img src={result.url} alt={m.preview} className={previewClass} />
                  ) : (
                    <video src={result.url} aria-label={m.preview} autoPlay loop muted playsInline controls className={previewClass} />
                  ))}
                {isBusy && (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs tabular-nums">
                      <Loader2 className="size-3.5 animate-spin text-gold" />
                      {progress === null ? m.rendering : m.renderingVideo(progress)}
                    </span>
                  </div>
                )}
                {error && !isBusy && (
                  <div className="absolute inset-0 grid place-items-center p-4 text-center">
                    <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="size-5" />
                      {error === 'unsupported' ? m.videoUnsupported : m.failed}
                      {error === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                          {m.retry}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {canShareFiles && (
                  <Button onClick={shareMedia} disabled={!isReady}>
                    <Share2 />
                    {isVideo ? m.shareVideo : m.shareImage}
                  </Button>
                )}
                <Button variant={canShareFiles ? 'outline' : 'default'} onClick={download} disabled={!isReady}>
                  <Download />
                  {m.download}
                </Button>
                {canCopyImage && !canShareFiles && !isVideo && (
                  <Button variant="outline" onClick={copyImage} disabled={!isReady}>
                    <Copy />
                    {m.copyImage}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
              {kind === 'compare' && (
                <Field label={m.layout}>
                  <Choice<Layout>
                    value={layout}
                    onChange={setLayout}
                    options={LAYOUTS.map((key) => ({ key, label: m.layouts[key] }))}
                    label={m.layout}
                  />
                </Field>
              )}

              {isVideo && (
                <Field label={m.years}>
                  <div className="grid grid-cols-2 gap-2">
                    {range.map((y, i) => (
                      <div key={i} className="grid gap-1">
                        <span className="text-[11px] text-muted-foreground">{i ? m.to : m.from}</span>
                        <YearSelect
                          value={y}
                          onChange={(next) => setRange((prev) => setRangeSide(prev, i as Side, next))}
                          label={i ? m.to : m.from}
                          className="justify-between rounded-md border border-input bg-input/30"
                          isModal
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{m.videoLength(videoSeconds)}</span>
                </Field>
              )}

              <Field label={m.size}>
                <Choice<Format>
                  value={format}
                  onChange={setFormat}
                  options={FORMATS.map(({ key }) => ({ key, ...m.formats[key] }))}
                  label={m.size}
                />
              </Field>

              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <Type className="size-4 text-muted-foreground" />
                  {m.showStreetNames}
                </span>
                <Switch checked={hasLabels} onCheckedChange={setHasLabels} />
              </label>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
