'use client';

import { ChevronLeft, ChevronRight, Maximize2, Share, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMapState } from '@/lib/map-store';
import { NEAR_YEARS, nearestPhoto, yearNumber, type Credit, type Photo, type Spot } from '@/lib/spots';
import { cn } from '@/lib/utils';
import { yearDef } from '@/lib/years';

export const DRAWER_PEEK = 0.55;
export const PANEL_WIDTH = 480;

function CreditLine({ c }: { c: Credit }) {
  return (
    <>
      {c.author} ·{' '}
      {c.licenceUrl ? (
        <a href={c.licenceUrl} target="_blank" rel="noopener">
          {c.licence}
        </a>
      ) : (
        c.licence
      )}
      {c.sourceUrl && (
        <>
          {' · '}
          <a href={c.sourceUrl} target="_blank" rel="noopener">
            {c.source || 'source'}
          </a>
        </>
      )}
    </>
  );
}

function SinglePhoto({ photo, alt, sizes, className }: { photo: Photo; alt: string; sizes: string; className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-neutral-900', className)}
      style={{ aspectRatio: photo.ratio }}
    >
      <Image src={photo.src} alt={alt} fill sizes={sizes} priority className="object-cover" />
      <span className="photo-tag left-3">{photo.date}</span>
    </div>
  );
}

function PlaceContent({ spot, onClose }: { spot: Spot; onClose(): void }) {
  const map = useMapState();
  const mapYear = map.swipe ? map.swipe[0] : map.year;
  const fromMap = nearestPhoto(spot, yearNumber(mapYear));
  const [picked, setPicked] = useState<Photo | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => setPicked(null), [mapYear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !zoomed && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose, zoomed]);

  const photo = picked ?? fromMap;
  const index = spot.photos.indexOf(photo);
  const gap = !picked && Math.abs(fromMap.year - yearNumber(mapYear)) > NEAR_YEARS;
  const first = spot.photos[0];
  const last = spot.photos[spot.photos.length - 1];

  const share = async () => {
    const shareUrl = `${location.origin}/spots/${spot.id}${location.search}`;
    const data = { title: `${spot.name}: Warsaw then and now`, url: shareUrl };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        return await navigator.share(data);
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast(shareUrl);
    }
  };

  const step = (d: number) => setPicked(spot.photos[(index + d + spot.photos.length) % spot.photos.length]);

  return (
    <div className="px-4 pt-1 pb-[calc(24px+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-gold uppercase tabular-nums">
            {first.year === last.year ? first.date : `${first.year}–${last.year}`} · {spot.photos.length} photos
            {spot.kind === 'modern' && (
              <Badge variant="outline" className="h-4.5 border-gold/40 px-1.5 text-[10px] tracking-normal text-gold normal-case">
                Modern
              </Badge>
            )}
          </p>
          <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-[28px]">{spot.name}</h1>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button variant="outline" size="icon" className="rounded-full" onClick={share} aria-label="Share">
            <Share />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
      </header>

      <div className="group/photo relative">
        <SinglePhoto photo={photo} alt={`${spot.name}, ${photo.date}`} sizes="(max-width: 720px) 100vw, 460px" />
        {spot.photos.length > 1 &&
          ([
            [-1, ChevronLeft, 'Older photo', 'left-2'],
            [1, ChevronRight, 'Newer photo', 'right-2'],
          ] as const).map(([d, Icon, label, side]) => (
            <button
              key={d}
              type="button"
              onClick={() => step(d)}
              aria-label={label}
              title={label}
              className={cn(
                'absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:opacity-0 sm:group-hover/photo:opacity-100 sm:focus-visible:opacity-100',
                side,
              )}
            >
              <Icon className="size-5" />
            </button>
          ))}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Full screen"
          title="Full screen"
          className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      {gap && (
        <p className="mt-2 text-xs text-muted-foreground">
          No photo from around {yearDef(mapYear).label} here; showing {fromMap.date}.
        </p>
      )}

      <p className="credit mt-3 text-[13px] leading-snug text-muted-foreground">
        <strong className="text-foreground tabular-nums">{photo.date}</strong>
        {photo.caption && <> · {photo.caption}</>}
        <br />
        <span className="text-xs">
          <CreditLine c={photo.credit} />
        </span>
      </p>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">All photos</h2>
          {picked && picked !== fromMap && (
            <button type="button" onClick={() => setPicked(null)} className="text-xs font-medium text-gold hover:text-gold/80">
              Back to the map&apos;s year ({yearDef(mapYear).label})
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-0.5 pb-2">
          {spot.photos.map((p) => {
            const on = p === photo;
            return (
              <button
                key={p.src}
                type="button"
                onClick={() => setPicked(p)}
                aria-pressed={picked === p}
                className="group shrink-0 text-center"
              >
                <img
                  src={p.pin}
                  alt=""
                  className={cn(
                    'size-16 rounded-lg object-cover ring-offset-2 ring-offset-background transition',
                    on ? 'ring-2 ring-gold' : 'opacity-75 group-hover:opacity-100',
                  )}
                />
                <span className={cn('mt-1 block text-[11px] tabular-nums', on ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {p.approx ? `c. ${p.year}` : p.year}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {spot.description && <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{spot.description}</p>}

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="flex max-h-none w-auto max-w-[calc(100vw-24px)] flex-col items-center border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-48px)]">
          <DialogTitle className="sr-only">{spot.name}</DialogTitle>
          <div style={{ width: `min(calc(100vw - 32px), calc((100dvh - 160px) * ${photo.ratio}))` }}>
            <SinglePhoto photo={photo} alt={`${spot.name}, ${photo.date}`} sizes="(max-width: 720px) 100vw, 1600px" />
          </div>
          <DialogDescription className="max-w-2xl text-center text-[13px] text-muted-foreground">
            {spot.name} · {photo.date}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PlacePanel({ spot }: { spot: Spot }) {
  const router = useRouter();
  const mobile = useIsMobile();
  const [snap, setSnap] = useState<number | string | null>(DRAWER_PEEK);
  const close = () => router.push(`/${location.search}`, { scroll: false });

  if (mobile) {
    return (
      <Drawer
        open
        onOpenChange={(o) => !o && close()}
        modal={false}
        snapPoints={[DRAWER_PEEK, 1]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <DrawerContent hideOverlay className="glass-strong z-[1050] h-[calc(100dvh-56px)] max-h-none!">
          <DrawerTitle className="sr-only">{spot.name}</DrawerTitle>
          <DrawerDescription className="sr-only">Photos of {spot.name} over the years</DrawerDescription>
          <div className={cn('overflow-y-auto overscroll-contain', snap === 1 ? 'h-full' : 'h-[calc(55dvh-48px)]')}>
            <PlaceContent key={spot.id} spot={spot} onClose={close} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside
      aria-label={spot.name}
      style={{ width: PANEL_WIDTH }}
      className="glass-strong fixed top-3 right-3 bottom-3 z-[1050] animate-in overflow-y-auto overscroll-contain rounded-2xl duration-300 slide-in-from-right-8 fade-in-0"
    >
      <PlaceContent key={spot.id} spot={spot} onClose={close} />
    </aside>
  );
}
