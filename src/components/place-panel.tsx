'use client';

import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLocale, useMessages } from '@/components/locale-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { localePath } from '@/lib/i18n';
import { useMapState, useSecondSide } from '@/lib/map-store';
import { NEAR_YEARS, nearestPhoto, yearNumber, type Credit, type Photo, type Spot } from '@/lib/spots';
import { cn } from '@/lib/utils';

export const DRAWER_PEEK = 0.55;
export const PANEL_WIDTH = 480;

export function panelInset(isMobile: boolean) {
  return isMobile ? { right: 0, bottom: innerHeight * DRAWER_PEEK } : { right: PANEL_WIDTH + 24, bottom: 0 };
}

interface CreditLineProps {
  c: Credit;
}

function CreditLine({ c }: CreditLineProps) {
  const t = useMessages();
  return (
    <p
      title={[c.author, c.licence, c.source].filter(Boolean).join(' · ')}
      className="mt-1 truncate text-xs text-muted-foreground [&_a]:underline [&_a]:decoration-muted-foreground/40 [&_a]:underline-offset-2 [&_a:hover]:text-foreground"
    >
      {t.spot.credit}:{' '}
      {c.sourceUrl ? (
        <a href={c.sourceUrl} target="_blank" rel="noopener" aria-label={`${c.author} (${c.source || t.spot.source})`}>
          {c.author}
        </a>
      ) : (
        c.author
      )}
      {' · '}
      {c.licenceUrl ? (
        <a href={c.licenceUrl} target="_blank" rel="noopener">
          {c.licence}
        </a>
      ) : (
        c.licence
      )}
    </p>
  );
}

const PANEL_FRAME = 4 / 3;

interface SinglePhotoProps {
  photo: Photo;
  alt: string;
  sizes: string;
  frame?: number;
  className?: string;
}

function SinglePhoto({ photo, alt, sizes, frame, className }: SinglePhotoProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg bg-neutral-900', className)}
      style={{ aspectRatio: frame ?? photo.ratio }}
    >
      <Image src={photo.src} alt={alt} fill sizes={sizes} priority className={frame ? 'object-contain' : 'object-cover'} />
    </div>
  );
}

interface PlaceContentProps {
  spot: Spot;
  onClose(): void;
}

function PlaceContent({ spot, onClose }: PlaceContentProps) {
  const t = useMessages();
  const map = useMapState();
  const isOnSecondSide = useSecondSide().has(spot.id);
  const mapYear = map.mode === 'compare' ? map.swipe[isOnSecondSide ? 1 : 0] : map.year;
  const fromMap = nearestPhoto(spot, yearNumber(mapYear));
  const [picked, setPicked] = useState<Photo | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => setPicked(null), [mapYear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !isZoomed && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose, isZoomed]);

  const photo = picked ?? fromMap;
  const index = spot.photos.indexOf(photo);
  const hasGap = Math.abs(fromMap.year - yearNumber(mapYear)) > NEAR_YEARS;
  const steps = [
    { delta: -1, icon: ChevronLeft, label: t.spot.older, side: 'left-2' },
    { delta: 1, icon: ChevronRight, label: t.spot.newer, side: 'right-2' },
  ];

  const step = (delta: number) => setPicked(spot.photos[(index + delta + spot.photos.length) % spot.photos.length]);

  return (
    <div className="px-4 pt-1 pb-[calc(24px+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <h1 className="min-w-0 font-heading text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{spot.name}</h1>
        <Button variant="outline" size="icon" className="shrink-0" onClick={onClose} aria-label={t.spot.close}>
          <X />
        </Button>
      </header>

      <div className="group/photo relative">
        <SinglePhoto
          photo={photo}
          alt={`${spot.name}, ${photo.date}`}
          sizes="(max-width: 720px) 100vw, 460px"
          frame={PANEL_FRAME}
        />
        {spot.photos.length > 1 &&
          steps.map(({ delta, icon: Icon, label, side }) => (
            <button
              key={delta}
              type="button"
              onClick={() => step(delta)}
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
          onClick={() => setIsZoomed(true)}
          aria-label={t.spot.fullScreen}
          title={t.spot.fullScreen}
          className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid text-[13px] leading-snug text-muted-foreground">
        {spot.photos.map((p) => (
          <p
            key={p.src}
            aria-hidden={p !== photo || undefined}
            className={cn('col-start-1 row-start-1', p !== photo && 'invisible')}
          >
            {p.caption}
            {hasGap && p === fromMap && (
              <span className="mt-1 block text-xs">{t.spot.gap(t.years[mapYear].label, fromMap.date)}</span>
            )}
          </p>
        ))}
      </div>
      <CreditLine c={photo.credit} />

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">{t.spot.allPhotos}</h2>
          {picked && picked !== fromMap && (
            <button type="button" onClick={() => setPicked(null)} className="text-xs font-medium text-gold hover:text-gold/80">
              {t.spot.backToYear(t.years[mapYear].label)}
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-0.5 pb-2">
          {spot.photos.map((p) => {
            const isSelected = p === photo;
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
                    isSelected ? 'ring-2 ring-gold' : 'opacity-75 group-hover:opacity-100',
                  )}
                />
                <span className={cn('mt-1 block text-[11px] tabular-nums', isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {p.approx ? t.spot.circa(p.year) : p.year}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {spot.description && <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{spot.description}</p>}

      <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
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

interface PlacePanelProps {
  spot: Spot;
}

export function PlacePanel({ spot }: PlacePanelProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages();
  const isMobile = useIsMobile();
  const [snap, setSnap] = useState<number | string | null>(DRAWER_PEEK);
  const close = () => router.push(`${localePath(locale, '/')}${location.search}`, { scroll: false });

  if (isMobile)
    return (
      <Drawer
        open
        onOpenChange={(o) => !o && close()}
        modal={false}
        snapPoints={[DRAWER_PEEK, 1]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <DrawerContent hideOverlay className="z-[1050] h-[calc(100dvh-56px)] max-h-none! border-x-0 border-b-0">
          <DrawerTitle className="sr-only">{spot.name}</DrawerTitle>
          <DrawerDescription className="sr-only">{t.spot.drawerDescription(spot.name)}</DrawerDescription>
          <div className={cn('overflow-y-auto overscroll-contain', snap === 1 ? 'h-full' : 'h-[calc(55dvh-48px)]')}>
            <PlaceContent key={spot.id} spot={spot} onClose={close} />
          </div>
        </DrawerContent>
      </Drawer>
    );

  return (
    <aside
      aria-label={spot.name}
      style={{ width: PANEL_WIDTH }}
      className="sheet fixed top-3 right-3 bottom-3 z-[1050] animate-in overflow-y-auto overscroll-contain rounded-2xl duration-300 slide-in-from-right-8 fade-in-0"
    >
      <PlaceContent key={spot.id} spot={spot} onClose={close} />
    </aside>
  );
}
