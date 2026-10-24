'use client';

import { Download, Film, Loader2, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useMessages } from '@/components/LocaleProvider';
import { Choice, Field, YearPair } from '@/components/ShareFields';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SITE_NAME } from '@/lib/site';
import type { SnapshotArea } from '@/lib/snapshot';
import {
  InterruptedError,
  PRESETS,
  SEQUENCES,
  VIDEO_FORMATS,
  VIDEO_KINDS,
  coveredYears,
  formatSize,
  prepareVideo,
  recordVideo,
  videoMimeType,
  type Sequence,
  type VideoFormat,
  type VideoKind,
} from '@/lib/video';
import { cn } from '@/lib/utils';
import { YEAR_KEYS, type YearKey } from '@/lib/years';

type Status =
  | { kind: 'loading'; done: number; total: number }
  | { kind: 'recording'; percent: number }
  | { kind: 'done' }
  | { kind: 'empty' }
  | { kind: 'unsupported' }
  | { kind: 'error' };

interface Clip {
  file: File;
  url: string;
  shareable: boolean;
}

const canShareFile = (file: File) => {
  try {
    return !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
};

export function VideoExport({
  area,
  labels,
  years: pair,
  onSide,
  onSwap,
  children,
}: {
  area: SnapshotArea;
  labels: boolean;
  years: [YearKey, YearKey];
  onSide(side: 0 | 1, year: YearKey): void;
  onSwap(): void;
  children: React.ReactNode;
}) {
  const t = useMessages();
  const m = t.share;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipRef = useRef<Clip | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<VideoKind>('timelapse');
  const [sequence, setSequence] = useState<Sequence>('short');
  const [custom, setCustom] = useState<YearKey[]>(PRESETS.full);
  const [format, setFormat] = useState<VideoFormat>('story');

  const covered = useMemo(() => coveredYears(area), [area]);
  const yearList = (
    kind === 'swipe'
      ? pair
      : (sequence === 'custom' ? YEAR_KEYS.filter((k) => custom.includes(k)) : PRESETS[sequence]).filter((k) => covered.has(k))
  ).join(',');
  const size = formatSize(format);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!videoMimeType()) return setStatus({ kind: 'unsupported' });
    const controller = new AbortController();
    const { signal } = controller;
    let resume: (() => void) | null = null;
    setClip(null);
    setStatus({ kind: 'loading', done: 0, total: 0 });

    const timer = setTimeout(async () => {
      try {
        const years = yearList ? (yearList.split(',') as YearKey[]) : [];
        const video = await prepareVideo(
          { kind, years, format, area, labels, host: location.host, credit: m.credit, yearLabel: (k) => t.years[k].label },
          signal,
          (done, total) => {
            if (!signal.aborted) setStatus({ kind: 'loading', done, total });
          },
        );
        if (signal.aborted) return;
        if (!video) return setStatus({ kind: 'empty' });

        let shown = -1;
        const blob = await recordVideo(canvas, video, signal, (fraction) => {
          const percent = Math.floor(fraction * 100);
          if (percent === shown) return;
          shown = percent;
          setStatus({ kind: 'recording', percent });
        });
        const ext = blob.type === 'video/mp4' ? 'mp4' : 'webm';
        const first = years[0];
        const last = years[years.length - 1];
        const name = kind === 'swipe' ? `${first}-vs-${last}` : `timelapse-${first}-${last}`;
        const file = new File([blob], `${m.filePrefix}-${name}.${ext}`, { type: blob.type });
        if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
        clipRef.current = { file, url: URL.createObjectURL(blob), shareable: canShareFile(file) };
        setClip(clipRef.current);
        setStatus({ kind: 'done' });
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof InterruptedError) {
          setStatus({ kind: 'loading', done: 0, total: 0 });
          resume = () => {
            if (document.visibilityState === 'visible') setAttempt((n) => n + 1);
          };
          document.addEventListener('visibilitychange', resume);
          resume();
          return;
        }
        console.error('[share] video failed', e);
        setStatus({ kind: 'error' });
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
      if (resume) document.removeEventListener('visibilitychange', resume);
    };
  }, [area, kind, yearList, format, labels, attempt, t]);

  useEffect(
    () => () => {
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    },
    [],
  );

  const download = () => {
    if (!clip) return;
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = clip.file.name;
    a.click();
  };

  const share = async () => {
    if (!clip) return;
    try {
      await navigator.share({ files: [clip.file], title: SITE_NAME });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(m.videoShareFailed);
    }
  };

  const ready = status.kind === 'done' && !!clip;
  const notice =
    status.kind === 'empty'
      ? sequence === 'custom'
        ? m.pickYears
        : m.notEnoughYears
      : status.kind === 'unsupported'
        ? m.videoUnsupported
        : status.kind === 'error'
          ? m.videoFailed
          : null;

  return (
    <>
      <div className="grid content-start gap-3">
        <div
          className="relative mx-auto w-full overflow-hidden rounded-lg bg-[#1a1b1e] ring-1 ring-foreground/10"
          style={{ aspectRatio: `${size.width} / ${size.height}`, maxHeight: '58dvh', maxWidth: `calc(58dvh * ${size.width / size.height})` }}
        >
          <canvas ref={canvasRef} aria-hidden className={cn('size-full', (clip || status.kind === 'loading') && 'hidden')} />
          {clip && (
            <video src={clip.url} autoPlay loop muted playsInline aria-label={m.videoPreview} className="size-full object-contain" />
          )}
          {status.kind === 'loading' && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin text-gold" />
                {status.total ? m.loadingYears(status.done, status.total) : m.rendering}
              </span>
            </div>
          )}
          {status.kind === 'recording' && (
            <div className="absolute inset-x-0 bottom-0 grid gap-2 p-3">
              <span className="glass-strong mx-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs tabular-nums">
                <span className="size-2 animate-pulse rounded-full bg-red-500" />
                {m.recording(status.percent)}
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-gold" style={{ width: `${status.percent}%` }} />
              </div>
            </div>
          )}
          {notice && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center">
              <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
                <Film className="size-5" />
                {notice}
                {status.kind === 'error' && (
                  <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                    {m.retry}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {clip?.shareable && (
            <Button onClick={share} disabled={!ready}>
              <Share2 />
              {m.shareVideo}
            </Button>
          )}
          <Button variant={clip?.shareable ? 'outline' : 'default'} onClick={download} disabled={!ready}>
            <Download />
            {m.download}
          </Button>
        </div>
        {status.kind === 'recording' && <p className="text-center text-xs text-muted-foreground">{m.keepOpen}</p>}
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
        <Field label={m.videoKind}>
          <Choice<VideoKind>
            value={kind}
            onChange={setKind}
            options={VIDEO_KINDS.map((key) => ({ key, ...m.videoKinds[key] }))}
            label={m.videoKind}
          />
        </Field>

        {kind === 'swipe' ? (
          <YearPair years={pair} sides={[m.from, m.to]} onSide={onSide} onSwap={onSwap} />
        ) : (
          <Field label={m.sequence}>
            <Choice<Sequence>
              value={sequence}
              onChange={setSequence}
              options={SEQUENCES.map((key) => ({ key, ...m.sequences[key] }))}
              label={m.sequence}
            />
            {sequence === 'custom' && (
              <ToggleGroup
                type="multiple"
                size="sm"
                variant="outline"
                spacing={1}
                value={custom}
                onValueChange={(v) => setCustom(v as YearKey[])}
                aria-label={m.sequence}
                className="w-full flex-wrap"
              >
                {YEAR_KEYS.map((k) => (
                  <ToggleGroupItem
                    key={k}
                    value={k}
                    disabled={!covered.has(k)}
                    title={covered.has(k) ? undefined : m.noPhotosHere}
                    className="h-7 min-w-0 px-2 text-xs tabular-nums data-[state=on]:bg-foreground data-[state=on]:text-background"
                  >
                    {t.years[k].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </Field>
        )}

        <Field label={m.size}>
          <Choice<VideoFormat>
            value={format}
            onChange={setFormat}
            options={VIDEO_FORMATS.map(({ key }) => ({ key, ...m.videoFormats[key] }))}
            label={m.size}
          />
        </Field>

        {children}
      </div>
    </>
  );
}
