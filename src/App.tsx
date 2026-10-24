import type L from 'leaflet';
import { LocateFixed, Type } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AboutDialog } from '@/components/AboutDialog';
import { MapView, WARSAW_BOUNDS } from '@/components/map/MapView';
import { SwipeDivider } from '@/components/map/SwipeDivider';
import { DRAWER_PEEK, PANEL_WIDTH, SpotPanel } from '@/components/SpotPanel';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { YearControls } from '@/components/YearControls';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTileLoading } from '@/lib/loading';
import { loadSpots, type Spot } from '@/lib/spots';
import { readUrlState, stateToQuery, writeUrlState, type AppState } from '@/lib/state';
import { yearDef, YEARS, type YearKey } from '@/lib/years';
import { cn } from '@/lib/utils';

const HINT_KEY = 'wtm-dragged';
const readHintSeen = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(readUrlState);
  const [map, setMap] = useState<L.Map | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [ratio, setRatio] = useState(0.5);
  const [hintSeen, setHintSeen] = useState(readHintSeen);
  const [labels, setLabels] = useState(false);
  const [me, setMe] = useState<L.LatLng | null>(null);
  const mobile = useIsMobile();

  const spot = spots.find((s) => s.id === state.spot) ?? null;

  useEffect(() => writeUrlState(state), [state]);
  useEffect(() => {
    document.title = spot ? `${spot.name}: Warsaw 1935 / 1945 / Today` : 'Warsaw 1935 / 1945 / Today';
  }, [spot]);

  useEffect(() => {
    loadSpots().then(setSpots, (e) => console.error(e));
  }, []);

  // ---- year actions

  const setYear = (year: YearKey) => setState((s) => ({ ...s, year }));
  const setSide = (side: 0 | 1, y: YearKey) =>
    setState((s) => {
      if (!s.swipe) return s;
      const next: [YearKey, YearKey] = [...s.swipe];
      // Picking the year that's already on the other side swaps the two.
      if (next[1 - side] === y) next[1 - side] = next[side];
      next[side] = y;
      return { ...s, swipe: next };
    });
  const swap = () => setState((s) => (s.swipe ? { ...s, swipe: [s.swipe[1], s.swipe[0]] } : s));
  const toggleCompare = () =>
    setState((s) =>
      s.swipe
        ? { ...s, year: s.swipe[1], swipe: null }
        : { ...s, swipe: [s.year === 'today' ? '1935' : s.year, 'today'] },
    );

  // ---- spots

  const flyToSpot = useCallback(
    (s: Spot) => {
      if (!map) return;
      // Centre the pin in the part of the map that the panel doesn't cover.
      const covered = mobile ? { x: 0, y: innerHeight * DRAWER_PEEK } : { x: PANEL_WIDTH + 24, y: 0 };
      const zoom = Math.max(map.getZoom(), 17);
      const p = map.project([s.lat, s.lng], zoom).add([covered.x / 2, covered.y / 2]);
      map.flyTo(map.unproject(p, zoom), zoom, { duration: 0.8 });
    },
    [map, mobile],
  );

  const openSpot = (id: string) => {
    setState((s) => ({ ...s, spot: id }));
    const s = spots.find((x) => x.id === id);
    if (s) flyToSpot(s);
  };
  const closeSpot = () => setState((s) => ({ ...s, spot: null }));

  // Spot from the URL: jump there once the map and spots are ready.
  useEffect(() => {
    if (!map || !spots.length || !state.spot) return;
    const s = spots.find((x) => x.id === state.spot);
    if (!s) return setState((st) => ({ ...st, spot: null }));
    map.setView([s.lat, s.lng], 17, { animate: false });
    flyToSpot(s);
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, spots.length]);

  const shareUrl = spot
    ? import.meta.env.DEV
      ? `${location.origin}/${stateToQuery({ ...state, spot: spot.id })}`
      : // /s/<id>/ is a static page with Open Graph tags (scripts/build-spot-pages.mjs) that redirects to /?spot=<id>.
        `${location.origin}/s/${spot.id}/${stateToQuery({ ...state, spot: null })}`
    : '';

  // ---- location

  useEffect(() => {
    if (!map) return;
    const found = (e: L.LocationEvent) => {
      if (!WARSAW_BOUNDS.contains(e.latlng)) return void toast("You're outside Warsaw");
      setMe(e.latlng);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 17));
    };
    const failed = () => toast.error("Couldn't find your location");
    map.on('locationfound', found);
    map.on('locationerror', failed);
    return () => {
      map.off('locationfound', found);
      map.off('locationerror', failed);
    };
  }, [map]);

  // ---- keyboard shortcuts: 1/2/3 (Shift = left side), C compare, S swap, [ ] move divider

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      const digit = /^Digit([123])$/.exec(e.code);
      if (digit) {
        const y = YEARS[+digit[1] - 1].key;
        setState((s) => {
          if (!s.swipe) return { ...s, year: y };
          const side = e.shiftKey ? 0 : 1;
          const next: [YearKey, YearKey] = [...s.swipe];
          if (next[1 - side] === y) next[1 - side] = next[side];
          next[side] = y;
          return { ...s, swipe: next };
        });
      } else if (e.key === 'c' || e.key === 'C') toggleCompare();
      else if (e.key === 's' || e.key === 'S') swap();
      else if (e.key === '[') setRatio((r) => Math.max(0, r - 0.05));
      else if (e.key === ']') setRatio((r) => Math.min(1, r + 0.05));
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const loading = useTileLoading();
  const busy = loading.total > 0 && loading.done < loading.total;
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    // Short delay so cached tiles don't flash the indicator.
    if (!busy) return setShowLoading(false);
    const t = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(t);
  }, [busy]);

  const panelOpen = !!spot && !mobile;
  // Leaflet's own controls (zoom, attribution) live outside React; shift them via a root class.
  useEffect(() => {
    document.documentElement.classList.toggle('panel-open', panelOpen);
  }, [panelOpen]);

  return (
    <>
      <MapView
        left={state.swipe ? state.swipe[0] : state.year}
        right={state.swipe ? state.swipe[1] : null}
        spots={spots}
        activeSpot={state.spot}
        onSpot={openSpot}
        showLabels={labels}
        myLocation={me}
        onMap={setMap}
      />

      {map && state.swipe && (
        <SwipeDivider
          map={map}
          ratio={ratio}
          onRatio={setRatio}
          leftLabel={yearDef(state.swipe[0]).label}
          rightLabel={yearDef(state.swipe[1]).label}
          showHint={!hintSeen}
          onDragStart={() => {
            if (hintSeen) return;
            setHintSeen(true);
            try {
              localStorage.setItem(HINT_KEY, '1');
            } catch {
              /* private mode */
            }
          }}
        />
      )}

      <AboutDialog />

      <div
        className={cn('transition-[padding] duration-300', panelOpen && 'sm:[&>nav]:-translate-x-[calc(var(--pw)/2)]')}
        style={{ ['--pw' as string]: `${PANEL_WIDTH + 12}px` }}
      >
        <YearControls state={state} setYear={setYear} setSide={setSide} swap={swap} toggleCompare={toggleCompare} />
      </div>

      <div
        className={cn(
          'fixed right-3.5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[900] flex flex-col gap-2 transition-[right] duration-300 sm:bottom-24',
          panelOpen && 'sm:right-[calc(420px+38px)]',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className={cn('glass-strong rounded-xl', labels && 'bg-foreground! text-background!')}
              onClick={() => setLabels((v) => !v)}
              aria-pressed={labels}
              aria-label="Street names"
            >
              <Type />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Street names</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="glass-strong rounded-xl"
              onClick={() => map?.locate({ enableHighAccuracy: true })}
              aria-label="My location"
            >
              <LocateFixed />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">My location</TooltipContent>
        </Tooltip>
      </div>

      {showLoading && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[1100]">
          <div className="h-[3px] bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-gold to-[#f4dca6] transition-[width] duration-300"
              style={{ width: `${loading.total ? Math.round((loading.done / loading.total) * 100) : 100}%` }}
            />
          </div>
          <div className="glass-strong fixed top-14 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap text-foreground/85 tabular-nums sm:top-16">
            <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
            Loading aerial photos… {loading.done}/{loading.total}
          </div>
        </div>
      )}

      <SpotPanel spot={spot} onClose={closeSpot} shareUrl={shareUrl} />
      <Toaster theme="dark" position={mobile ? 'top-center' : 'bottom-center'} />
    </>
  );
}
