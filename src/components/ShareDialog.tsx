'use client';

import type L from 'leaflet';
import { ArrowLeftRight, Check, Copy, Download, ImageIcon, Link2, Loader2, Share2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { YearSelect } from '@/components/YearControls';
import { SITE_NAME } from '@/lib/site';
import { FORMATS, LAYOUTS, formatSize, renderSnapshot, toBlob, type Format, type Layout, type SnapshotArea } from '@/lib/snapshot';
import { mapStateToQuery, type MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import type { YearKey } from '@/lib/years';

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange(v: T): void;
  options: { key: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.key}
          value={o.key}
          className="h-auto min-h-8 min-w-0 flex-1 shrink flex-col gap-0 px-1 py-1 text-xs leading-tight data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {o.label}
          {o.hint && <span className="text-[10px] opacity-60">{o.hint}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ShareDialog({
  map,
  state,
  ratio,
  labels,
  inset,
  spotName,
}: {
  map: L.Map;
  state: MapState;
  ratio: number;
  labels: boolean;
  inset: Inset;
  spotName: string | null;
}) {
  const t = useMessages();
  const m = t.share;
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Capture | null>(null);
  const [years, setYears] = useState<[YearKey, YearKey]>(['1935', 'today']);
  const [layout, setLayout] = useState<Layout>('split');
  const [format, setFormat] = useState<Format>('screen');
  const [withLabels, setWithLabels] = useState(false);
  const [title, setTitle] = useState('');
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
      setTitle(spotName ?? '');
      setCopied(false);
    }
    setOpen(next);
  };

  useEffect(() => {
    if (!open || !snap) return;
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
          title,
          host: location.host,
          yearLabels: [t.years[years[0]].label, t.years[years[1]].label],
          place: m.place,
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
  }, [open, snap, years, layout, format, withLabels, title, attempt, t]);

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
  const sides = layout === 'stack' || (layout === 'split' && snap?.horizontal) ? [m.top, m.bottom] : [m.left, m.right];
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon-lg" className="glass-strong rounded-xl" aria-label={m.trigger}>
              <Share2 />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">{m.title}</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{m.title}</DialogTitle>
          <DialogDescription>{m.description}</DialogDescription>
        </DialogHeader>

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
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{m.years}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setYears(([a, b]) => [b, a])}
                  aria-label={m.swapYears}
                  title={m.swapYears}
                >
                  <ArrowLeftRight />
                </Button>
              </div>
              {years.map((year, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">
                    {sides[i]}
                  </span>
                  <YearSelect
                    value={year}
                    onChange={(y) => setSide(i as 0 | 1, y)}
                    label={m.sideYear(sides[i])}
                    className="flex-1 justify-between rounded-md border border-input bg-input/30"
                    modal
                  />
                </div>
              ))}
            </div>

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

            <Field label={m.titleField}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={70}
                placeholder={m.titlePlaceholder}
                className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>

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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
