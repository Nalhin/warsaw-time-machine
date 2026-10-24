'use client';

import { Share, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { CompareSlider } from '@/components/CompareSlider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Credit, Spot } from '@/lib/spots';
import { cn } from '@/lib/utils';

export const DRAWER_PEEK = 0.55;
export const PANEL_WIDTH = 420;

function CreditLine({ c }: { c: string | Credit }) {
  if (typeof c === 'string') {
    const parts = c.split(/(https?:\/\/[^\s,;)]+)/g);
    return (
      <>
        {parts.map((p, i) =>
          /^https?:\/\//.test(p) ? (
            <a key={i} href={p} target="_blank" rel="noopener">
              source
            </a>
          ) : (
            p
          ),
        )}
      </>
    );
  }
  return (
    <>
      {c.author}
      {c.date && `, ${c.date}`} ·{' '}
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

type Zoomed = { node: ReactNode; caption: ReactNode } | null;

function SpotContent({ spot, onClose }: { spot: Spot; onClose(): void }) {
  const [useAi, setUseAi] = useState(false);
  const [zoomed, setZoomed] = useState<Zoomed>(null);
  const oldLabel = spot.oldYear || 'Pre-war';
  const cmp = spot.compare;
  const restored = cmp ? cmp.restored : spot.restored;
  const after = cmp ? cmp.today : spot.today;
  const before = useAi && restored ? restored : cmp ? cmp.old : spot.old;
  const beforeLabel = useAi ? 'AI colour' : oldLabel;

  const share = async () => {
    const shareUrl = `${location.origin}/spots/${spot.id}${location.search}`;
    const data = { title: `${spot.name}: Warsaw before the war and today`, url: shareUrl };
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

  const shots = [
    { src: spot.old, title: oldLabel, kicker: 'Original photograph', credit: <CreditLine c={spot.credits.old} /> },
    ...(spot.restored
      ? [
          {
            src: spot.restored,
            title: 'AI-restored',
            kicker: 'The colours are a guess',
            credit: 'The same photograph, upscaled with Real-ESRGAN and coloured by the DDColor model. This is not a historical record.',
            ai: true,
          },
        ]
      : []),
    { src: spot.today, title: 'Today', kicker: 'Recent photograph', credit: <CreditLine c={spot.credits.today} /> },
  ];

  return (
    <div className="px-4 pt-1 pb-[calc(24px+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">Before the war &amp; today</p>
          <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-[28px]">{spot.name}</h1>
          {spot.heading && <p className="mt-1.5 text-sm text-muted-foreground">{spot.heading}</p>}
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="rounded-full" onClick={share} aria-label="Share">
            <Share />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
      </header>

      <CompareSlider
        before={before}
        after={after}
        beforeLabel={beforeLabel}
        afterLabel="Today"
        alt={spot.name}
        onExpand={() =>
          setZoomed({
            node: (
              <CompareSlider
                before={before}
                after={after}
                beforeLabel={beforeLabel}
                afterLabel="Today"
                alt={spot.name}
                className="max-h-[calc(100dvh-140px)] w-[min(1200px,100%)]"
              />
            ),
            caption: spot.name,
          })
        }
      />

      {cmp && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          The modern photo is aligned to the old camera angle (perspective correction only).
        </p>
      )}

      {restored && (
        <ToggleGroup
          type="single"
          size="sm"
          spacing={0}
          value={useAi ? 'ai' : 'old'}
          onValueChange={(v) => v && setUseAi(v === 'ai')}
          aria-label="Left side of the comparison"
          className="mx-auto mt-3 rounded-full border p-0.5"
        >
          {[
            ['old', 'Original'],
            ['ai', 'AI colour'],
          ].map(([v, l]) => (
            <ToggleGroupItem
              key={v}
              value={v}
              className="h-7 rounded-full! px-3 text-xs font-semibold data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {spot.description && <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">{spot.description}</p>}

      <h3 className="mt-6 mb-2.5 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Three views</h3>
      <div className="grid gap-5">
        {shots.map((s) => (
          <figure key={s.title} className="m-0">
            <button
              type="button"
              aria-label={`Enlarge: ${s.title}`}
              className={cn(
                'group relative block w-full cursor-zoom-in overflow-hidden rounded-lg bg-neutral-800',
                s.ai && 'ring-1 ring-ai/50',
              )}
              onClick={() =>
                setZoomed({
                  node: <img src={s.src} alt={s.title} className="max-h-[calc(100dvh-140px)] max-w-full rounded-md object-contain" />,
                  caption: (
                    <>
                      <strong className="text-foreground">{s.title}</strong> · {s.credit}
                    </>
                  ),
                })
              }
            >
              <span className="relative block aspect-[4/3] w-full">
                <Image
                  src={s.src}
                  alt={`${spot.name}: ${s.title.toLowerCase()}`}
                  fill
                  sizes="(max-width: 720px) 100vw, 380px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </span>
              {s.ai && (
                <Badge className="absolute top-2.5 left-2.5 border-0 bg-ai-deep/90 text-ai-foreground">AI · colours are a guess</Badge>
              )}
            </button>
            <figcaption className="mt-2 text-[13px] text-muted-foreground">
              <strong className={s.ai ? 'text-ai' : 'text-foreground'}>{s.title}</strong>{' '}
              <span className={s.ai ? 'text-ai' : ''}>{s.kicker}</span>
              <br />
              <span className="credit text-xs">{s.credit}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground/60 tabular-nums">
        Pin: {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
      </p>

      <Dialog open={!!zoomed} onOpenChange={(o) => !o && setZoomed(null)}>
        <DialogContent className="flex max-h-none w-auto max-w-[calc(100vw-24px)] flex-col items-center border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-48px)]">
          <DialogTitle className="sr-only">{spot.name}</DialogTitle>
          {zoomed?.node}
          <DialogDescription className="max-w-2xl text-center text-[13px] text-muted-foreground">{zoomed?.caption}</DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SpotPanel({ spot }: { spot: Spot }) {
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
          <DrawerDescription className="sr-only">Old photo, AI-restored version and today</DrawerDescription>
          <div className={cn('overflow-y-auto overscroll-contain', snap === 1 ? 'h-full' : 'h-[calc(55dvh-48px)]')}>
            <SpotContent key={spot.id} spot={spot} onClose={close} />
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
      <SpotContent key={spot.id} spot={spot} onClose={close} />
    </aside>
  );
}
