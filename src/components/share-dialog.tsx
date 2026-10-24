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
import { Choice, Field, YearPair } from '@/components/share-fields';
import { SITE_NAME } from '@/lib/site';
import { FORMATS, LAYOUTS, formatSize, renderSnapshot, toBlob, type Format, type Layout, type SnapshotArea } from '@/lib/snapshot';
import { mapStateToQuery, setSwipeSide, type MapState, type Side, type SwipeYears } from '@/lib/state';
import { cn } from '@/lib/utils';
import { otherYear, type YearKey } from '@/lib/years';

type Mode = 'link' | 'image';

export interface Inset {
  right: number;
  bottom: number;
}

interface Capture {
  area: SnapshotArea;
  divider: number;
  isHorizontal: boolean;
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
    divider: state.isHorizontal ? (ratio * size.y) / height : (ratio * size.x) / width,
    isHorizontal: !!state.swipe && state.isHorizontal,
    link: `${location.origin}${location.pathname}${mapStateToQuery(state, camera)}`,
  };
}

function supportsFileShare() {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}

interface ShareDialogProps {
  map: L.Map;
  state: MapState;
  ratio: number;
  showLabels: boolean;
  inset: Inset;
}

export function ShareDialog({ map, state, ratio, showLabels, inset }: ShareDialogProps) {
  const t = useMessages();
  const m = t.share;
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('link');
  const [snap, setSnap] = useState<Capture | null>(null);
  const [years, setYears] = useState<SwipeYears>(['1935', 'today']);
  const [layout, setLayout] = useState<Layout>('split');
  const [format, setFormat] = useState<Format>('screen');
  const [hasLabels, setHasLabels] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canShareLink, setCanShareLink] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const resultRef = useRef<Result | null>(null);

  useEffect(() => {
    setCanShareFiles(supportsFileShare());
    setCanShareLink(!!navigator.share);
    setCanCopyImage(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write);
  }, []);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSnap(capture(map, state, ratio, inset));
      setYears(state.swipe ? [...state.swipe] : [state.year, otherYear(state.year)]);
      setHasLabels(showLabels);
      setIsCopied(false);
      setMode('link');
    }
    setIsOpen(next);
  };

  useEffect(() => {
    if (!isOpen || !snap || mode !== 'image') return;
    let isCancelled = false;
    setIsBusy(true);
    setHasError(false);
    const timer = setTimeout(async () => {
      try {
        const canvas = await renderSnapshot({
          years,
          layout,
          format,
          area: snap.area,
          divider: snap.divider,
          isHorizontal: snap.isHorizontal,
          hasLabels,
          host: location.host,
          yearLabels: [t.years[years[0]].label, t.years[years[1]].label],
          credit: m.credit,
        });
        const blob = await toBlob(canvas);
        if (isCancelled) return;
        if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
        resultRef.current = { canvas, blob, url: URL.createObjectURL(blob) };
        setResult(resultRef.current);
      } catch (e) {
        console.error('[share] snapshot failed', e);
        if (!isCancelled) setHasError(true);
      } finally {
        if (!isCancelled) setIsBusy(false);
      }
    }, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, snap, mode, years, layout, format, hasLabels, attempt, t]);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    },
    [],
  );

  const setSide = (side: Side, year: YearKey) => setYears((prev) => setSwipeSide(prev, side, year));

  const fileName = `${m.filePrefix}-${years.join('-vs-')}.jpg`;
  const isReady = !!result && !isBusy && !hasError;
  const sides: [string, string] = layout === 'stack' || (layout === 'split' && snap?.isHorizontal) ? [m.top, m.bottom] : [m.left, m.right];
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

  const heading = mode === 'link' ? [m.title, m.description] : [m.imageTitle, m.imageDescription];
  const swapYears = () => setYears(([a, b]) => [b, a]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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

      <DialogContent className={cn('max-h-[calc(100dvh-32px)] overflow-y-auto', mode === 'link' ? 'sm:max-w-md' : 'sm:max-w-3xl')}>
        <DialogHeader>
          <DialogTitle>{heading[0]}</DialogTitle>
          <DialogDescription>{heading[1]}</DialogDescription>
        </DialogHeader>

        <div className="sm:max-w-60">
          <Choice<Mode>
            value={mode}
            onChange={setMode}
            options={(['link', 'image'] as const).map((key) => ({ key, label: m.modes[key] }))}
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
                {result && (
                  <img
                    src={result.url}
                    alt={m.preview}
                    className={cn('size-full object-contain transition-opacity', isBusy && 'opacity-50')}
                  />
                )}
                {isBusy && (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                      <Loader2 className="size-3.5 animate-spin text-gold" />
                      {m.rendering}
                    </span>
                  </div>
                )}
                {hasError && !isBusy && (
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
                {canShareFiles && (
                  <Button onClick={shareImage} disabled={!isReady}>
                    <Share2 />
                    {m.shareImage}
                  </Button>
                )}
                <Button variant={canShareFiles ? 'outline' : 'default'} onClick={download} disabled={!isReady}>
                  <Download />
                  {m.download}
                </Button>
                {canCopyImage && !canShareFiles && (
                  <Button variant="outline" onClick={copyImage} disabled={!isReady}>
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
