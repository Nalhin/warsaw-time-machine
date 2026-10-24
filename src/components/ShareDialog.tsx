'use client';

import type L from 'leaflet';
import { Check, Copy, Download, ImageIcon, Link2, Loader2, Share2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VideoExport } from '@/components/VideoExport';
import { Choice, Field, YearPair } from '@/components/ShareFields';
import { SITE_NAME } from '@/lib/site';
import { FORMATS, LAYOUTS, formatSize, renderSnapshot, toBlob, type Format, type Layout, type SnapshotArea } from '@/lib/snapshot';
import { mapStateToQuery, type MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import type { YearKey } from '@/lib/years';

type Mode = 'image' | 'video';

interface Inset {
  right: number;
  bottom: number;
}

interface Capture {
  area: SnapshotArea;
  divider: number;
  horizontal: boolean;
  link: string;
}

interface Result {
  canvas: HTMLCanvasElement;
  blob: Blob;
  url: string;
}

function capture(map: L.Map, state: MapState, ratio: number, inset: Inset): Capture {
  const size = map.getSize();
  const width = Math.max(1, size.x - inset.right);
  const height = Math.max(1, size.y - inset.bottom);
  const crs = map.options.crs!;
  const nw = crs.project(map.containerPointToLatLng([0, 0]));
  const se = crs.project(map.containerPointToLatLng([width, height]));
  const c = map.getCenter();
  const camera = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
  return {
    area: {
      cx: (nw.x + se.x) / 2,
      cy: (nw.y + se.y) / 2,
      width: se.x - nw.x,
      height: nw.y - se.y,
      zoom: map.getZoom(),
      metersPerPixel: (se.x - nw.x) / width,
    },
    divider: state.horizontal ? (ratio * size.y) / height : (ratio * size.x) / width,
    horizontal: !!state.swipe && state.horizontal,
    link: `${location.origin}${location.pathname}${mapStateToQuery(state, camera)}`,
  };
}

const otherYear = (y: YearKey): YearKey => (y === 'today' ? '1935' : 'today');

const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
};

export function ShareDialog({
  map,
  state,
  ratio,
  labels,
  inset,
}: {
  map: L.Map;
  state: MapState;
  ratio: number;
  labels: boolean;
  inset: Inset;
}) {
  const t = useMessages();
  const m = t.share;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('image');
  const [snap, setSnap] = useState<Capture | null>(null);
  const [years, setYears] = useState<[YearKey, YearKey]>(['1935', 'today']);
  const [layout, setLayout] = useState<Layout>('split');
  const [format, setFormat] = useState<Format>('screen');
  const [withLabels, setWithLabels] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shareFiles, setShareFiles] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const resultRef = useRef<Result | null>(null);

  useEffect(() => {
    setShareFiles(canShareFiles());
    setCanCopyImage(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write);
  }, []);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSnap(capture(map, state, ratio, inset));
      setYears(state.swipe ? [...state.swipe] : [state.year, otherYear(state.year)]);
      setWithLabels(labels);
      setCopied(false);
    }
    setOpen(next);
  };

  useEffect(() => {
    if (!open || !snap || mode !== 'image') return;
    let cancelled = false;
    setBusy(true);
    setError(false);
    const timer = setTimeout(async () => {
      try {
        const canvas = await renderSnapshot({
          years,
          layout,
          format,
          area: snap.area,
          divider: snap.divider,
          horizontal: snap.horizontal,
          labels: withLabels,
          host: location.host,
          yearLabels: [t.years[years[0]].label, t.years[years[1]].label],
          credit: m.credit,
        });
        const blob = await toBlob(canvas);
        if (cancelled) return;
        if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
        resultRef.current = { canvas, blob, url: URL.createObjectURL(blob) };
        setResult(resultRef.current);
      } catch (e) {
        console.error('[share] snapshot failed', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, snap, mode, years, layout, format, withLabels, attempt, t]);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    },
    [],
  );

  const setSide = (side: 0 | 1, y: YearKey) =>
    setYears((prev) => {
      const next: [YearKey, YearKey] = [...prev];
      if (next[1 - side] === y) next[1 - side] = next[side];
      next[side] = y;
      return next;
    });

  const fileName = `${m.filePrefix}-${years.join('-vs-')}.jpg`;
  const ready = !!result && !busy && !error;
  const sides: [string, string] = layout === 'stack' || (layout === 'split' && snap?.horizontal) ? [m.top, m.bottom] : [m.left, m.right];
  const preview = snap ? formatSize(format, snap.area) : { width: 1, height: 1 };

  const copyLink = async () => {
    if (!snap) return;
    try {
      await navigator.clipboard.writeText(snap.link);
      setCopied(true);
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
    if (!result) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(result.canvas, 'image/png') })]);
      toast.success(m.imageCopied);
    } catch {
      toast.error(m.imageCopyFailed);
    }
  };

  const shareImage = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: [new File([result.blob], fileName, { type: 'image/jpeg' })], title: SITE_NAME });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(m.imageShareFailed);
    }
  };

  const video = mode === 'video';
  const swapYears = () => setYears(([a, b]) => [b, a]);

  const shared = (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('w-fit', withLabels && 'bg-foreground! text-background!')}
        onClick={() => setWithLabels((v) => !v)}
        aria-pressed={withLabels}
      >
        <Type />
        {t.map.streetNames}
      </Button>

      <Field label={m.link}>
        <div className="flex gap-2">
          <input
            readOnly
            value={snap?.link ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={m.link}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-input/30 px-3 text-xs text-muted-foreground outline-none focus-visible:border-ring"
          />
          <Button variant="outline" size="icon" onClick={copyLink} aria-label={m.copyLink}>
            {copied ? <Check /> : <Link2 />}
          </Button>
          {shareFiles && (
            <Button variant="outline" size="icon" onClick={shareLink} aria-label={m.shareLink}>
              <Share2 />
            </Button>
          )}
        </div>
      </Field>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-full bg-gold px-4 text-sm font-semibold text-gold-foreground shadow-lg hover:bg-gold/85">
              <Share2 />
              {m.trigger}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{m.title}</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{video ? m.videoTitle : m.title}</DialogTitle>
          <DialogDescription>{video ? m.videoDescription : m.description}</DialogDescription>
        </DialogHeader>

        <div className="max-w-60">
          <Choice<Mode>
            value={mode}
            onChange={setMode}
            options={(['image', 'video'] as const).map((key) => ({ key, label: m.modes[key] }))}
            label={m.title}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_280px]">
          {video && snap ? (
            <VideoExport area={snap.area} labels={withLabels} years={years} onSide={setSide} onSwap={swapYears}>
              {shared}
            </VideoExport>
          ) : (
            <>
              <div className="grid content-start gap-3">
                <div
                  className="relative mx-auto w-full overflow-hidden rounded-lg bg-[#1a1b1e] ring-1 ring-foreground/10"
                  style={{ aspectRatio: `${preview.width} / ${preview.height}`, maxHeight: '58dvh', maxWidth: `calc(58dvh * ${preview.width / preview.height})` }}
                >
                  {result && (
                    <img
                      src={result.url}
                      alt={m.preview}
                      className={cn('size-full object-contain transition-opacity', busy && 'opacity-50')}
                    />
                  )}
                  {busy && (
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                        <Loader2 className="size-3.5 animate-spin text-gold" />
                        {m.rendering}
                      </span>
                    </div>
                  )}
                  {error && !busy && (
                    <div className="absolute inset-0 grid place-items-center p-4 text-center">
                      <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
                        <ImageIcon className="size-5" />
                        {m.failed}
                        <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                          {m.retry}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {shareFiles && (
                    <Button onClick={shareImage} disabled={!ready}>
                      <Share2 />
                      {m.shareImage}
                    </Button>
                  )}
                  <Button variant={shareFiles ? 'outline' : 'default'} onClick={download} disabled={!ready}>
                    <Download />
                    {m.download}
                  </Button>
                  {canCopyImage && !shareFiles && (
                    <Button variant="outline" onClick={copyImage} disabled={!ready}>
                      <Copy />
                      {m.copyImage}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
                <YearPair years={years} sides={sides} onSide={setSide} onSwap={swapYears} />

                <Field label={m.layout}>
                  <Choice<Layout>
                    value={layout}
                    onChange={setLayout}
                    options={LAYOUTS.map((key) => ({ key, label: m.layouts[key] }))}
                    label={m.layout}
                  />
                </Field>

                <Field label={m.size}>
                  <Choice<Format>
                    value={format}
                    onChange={setFormat}
                    options={FORMATS.map(({ key }) => ({ key, ...m.formats[key] }))}
                    label={m.size}
                  />
                </Field>

                {shared}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
