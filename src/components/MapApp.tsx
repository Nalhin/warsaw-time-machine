'use client';

import type L from 'leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { AboutDialog } from '@/components/AboutDialog';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LayersMenu } from '@/components/LayersMenu';
import { useLocale, useMessages } from '@/components/LocaleProvider';
import { CoverageNotice } from '@/components/map/CoverageNotice';
import { SwipeDivider } from '@/components/map/SwipeDivider';
import { DRAWER_PEEK, PANEL_WIDTH } from '@/components/PlacePanel';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { YearControls } from '@/components/YearControls';
import { useIsMobile } from '@/hooks/use-mobile';
import { localePath } from '@/lib/i18n';
import { useTileLoading } from '@/lib/loading';
import { WARSAW_BBOX } from '@/lib/site';
import { NO_SPOTS, publishMapState, publishSecondSide } from '@/lib/map-store';
import { spotIdFromPath, yearNumber, type Spot } from '@/lib/spots';
import { DEFAULT_STATE, START, mapStateToQuery, readCamera, readMapState, type MapCamera, type MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import { YEAR_KEYS, type YearKey } from '@/lib/years';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#1a1b1e]" />,
});

const ShareDialog = dynamic(() => import('@/components/ShareDialog').then((m) => m.ShareDialog), {
  ssr: false,
  loading: () => <div className="size-9" />,
});

const HINT_KEY = 'wtm-dragged';

function useSecondSidePins(map: L.Map | null, spots: Spot[], ratio: number, swipe: boolean, horizontal: boolean) {
  const [ids, setIds] = useState(NO_SPOTS);
  useEffect(() => {
    if (!map || !swipe) return setIds(NO_SPOTS);
    const update = () => {
      const size = map.getSize();
      const split = (horizontal ? size.y : size.x) * ratio;
      const next = spots
        .filter((s) => {
          const p = map.latLngToContainerPoint([s.lat, s.lng]);
          return (horizontal ? p.y : p.x) >= split;
        })
        .map((s) => s.id);
      setIds((prev) => (prev.size === next.length && next.every((id) => prev.has(id)) ? prev : new Set(next)));
    };
    update();
    map.on('move zoomend viewreset resize', update);
    return () => {
      map.off('move zoomend viewreset resize', update);
    };
  }, [map, spots, ratio, swipe, horizontal]);
  return ids;
}
const PLAY_HOLD_MS = 3500;

export function MapApp({ spots }: { spots: Spot[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages();
  const pathname = usePathname();
  const activeId = spotIdFromPath(pathname);
  const spot = spots.find((s) => s.id === activeId) ?? null;

  const [state, setState] = useState<MapState>(DEFAULT_STATE);
  const [camera, setCamera] = useState<MapCamera | null>(null);
  const [initialCamera, setInitialCamera] = useState<MapCamera>(START);
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [ratio, setRatio] = useState(0.5);
  const [hintSeen, setHintSeen] = useState(true);
  const [labels, setLabels] = useState(false);
  const [pins, setPins] = useState(true);
  const [me, setMe] = useState<L.LatLng | null>(null);
  const [playing, setPlaying] = useState(false);
  const mobile = useIsMobile();

  const flown = useRef<string | null>(null);

  useEffect(() => {
    setState(readMapState(location.search));
    const fromUrl = readCamera(location.search);
    if (fromUrl) {
      setCamera(fromUrl);
      setInitialCamera(fromUrl);
      if (activeId) flown.current = activeId;
    }
    try {
      setHintSeen(localStorage.getItem(HINT_KEY) === '1');
    } catch {
      setHintSeen(false);
    }
    setReady(true);
  }, []);

  useEffect(() => publishMapState(state), [state]);

  const secondSide = useSecondSidePins(map, spots, ratio, !!state.swipe, state.horizontal);
  useEffect(() => publishSecondSide(secondSide), [secondSide]);

  useEffect(() => {
    if (!ready) return;
    const url = `${location.pathname}${mapStateToQuery(state, camera)}`;
    if (url !== `${location.pathname}${location.search}`) history.replaceState(history.state, '', url);
  }, [state, camera, ready, pathname]);

  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const c = map.getCenter();
        setCamera({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      }, 300);
    };
    map.on('moveend', sync);
    return () => {
      clearTimeout(timer);
      map.off('moveend', sync);
    };
  }, [map]);

  const setYear = (year: YearKey) => {
    setPlaying(false);
    setState((s) => ({ ...s, year }));
  };
  const setSide = useCallback(
    (side: 0 | 1, y: YearKey) =>
      setState((s) => {
        if (!s.swipe) return s;
        const next: [YearKey, YearKey] = [...s.swipe];
        if (next[1 - side] === y) next[1 - side] = next[side];
        next[side] = y;
        return { ...s, swipe: next };
      }),
    [],
  );
  const toggleHorizontal = useCallback(() => setState((s) => ({ ...s, horizontal: !s.horizontal })), []);
  const swap = useCallback(() => setState((s) => (s.swipe ? { ...s, swipe: [s.swipe[1], s.swipe[0]] } : s)), []);
  const toggleCompare = useCallback(() => {
    setPlaying(false);
    setState((s) =>
      s.swipe ? { ...s, year: s.swipe[1], swipe: null } : { ...s, swipe: [s.year === 'today' ? '1935' : s.year, 'today'] },
    );
  }, []);
  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false);
    setState((s) => ({ ...s, swipe: null, year: s.swipe || s.year === 'today' ? YEAR_KEYS[0] : s.year }));
    setPlaying(true);
  }, [playing]);

  const openSpot = (id: string) => router.push(`${localePath(locale, `/spots/${id}`)}${location.search}`, { scroll: false });

  useEffect(() => {
    if (!map || !spot || flown.current === spot.id) return;
    const first = flown.current === null;
    flown.current = spot.id;
    const covered = mobile ? { x: 0, y: innerHeight * DRAWER_PEEK } : { x: PANEL_WIDTH + 24, y: 0 };
    const zoom = Math.max(first ? 17 : map.getZoom(), 16);
    const target = map.unproject(map.project([spot.lat, spot.lng], zoom).add([covered.x / 2, covered.y / 2]), zoom);
    if (first) map.setView(target, zoom, { animate: false });
    else if (zoom === map.getZoom()) map.panTo(target, { duration: 0.6 });
    else map.flyTo(target, zoom, { duration: 0.8 });
  }, [map, spot, mobile]);
  useEffect(() => {
    if (!spot) flown.current = '';
  }, [spot]);

  useEffect(() => {
    if (!map) return;
    const found = (e: L.LocationEvent) => {
      const { lat, lng } = e.latlng;
      const b = WARSAW_BBOX;
      if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return void toast(t.map.outsideWarsaw);
      setMe(e.latlng);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 17));
    };
    const failed = () => toast.error(t.map.locationFailed);
    map.on('locationfound', found);
    map.on('locationerror', failed);
    return () => {
      map.off('locationfound', found);
      map.off('locationerror', failed);
    };
  }, [map, t]);

  const panelOpen = !!spot && !mobile;
  useEffect(() => {
    document.documentElement.classList.toggle('panel-open', panelOpen);
  }, [panelOpen]);

  const loading = useTileLoading();
  const busy = loading.total > 0 && loading.done < loading.total;
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!busy) return setShowLoading(false);
    const t = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    if (!playing || busy) return;
    const next = YEAR_KEYS[YEAR_KEYS.indexOf(state.year) + 1];
    if (!next) return setPlaying(false);
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, year: next }));
      if (next === YEAR_KEYS[YEAR_KEYS.length - 1]) setPlaying(false);
    }, PLAY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [playing, busy, state.year]);

  return (
    <>
      {ready ? (
        <MapView
          camera={initialCamera}
          left={state.swipe ? state.swipe[0] : state.year}
          right={state.swipe ? state.swipe[1] : null}
          spots={spots}
          activeSpot={activeId}
          onSpot={openSpot}
          showLabels={labels}
          showPins={pins}
          years={state.swipe ? [yearNumber(state.swipe[0]), yearNumber(state.swipe[1])] : [yearNumber(state.year)]}
          secondSide={secondSide}
          myLocation={me}
          onMap={setMap}
        />
      ) : (
        <div className="fixed inset-0 bg-[#1a1b1e]" />
      )}

      {map && state.swipe && (
        <SwipeDivider
          map={map}
          ratio={ratio}
          onRatio={setRatio}
          horizontal={state.horizontal}
          leftLabel={t.years[state.swipe[0]].label}
          rightLabel={t.years[state.swipe[1]].label}
          showHint={!hintSeen}
          onDragStart={() => {
            if (hintSeen) return;
            setHintSeen(true);
            try {
              localStorage.setItem(HINT_KEY, '1');
            } catch {
            }
          }}
        />
      )}

      {map && <CoverageNotice map={map} years={state.swipe ?? [state.year]} />}

      <AboutDialog />

      <LanguageSwitch shifted={panelOpen} />

      <div
        className={cn(panelOpen && 'sm:[&>nav]:-translate-x-[calc(var(--pw)/2)]')}
        style={{ ['--pw' as string]: `${PANEL_WIDTH + 12}px` }}
      >
        <YearControls
          state={state}
          setYear={setYear}
          setSide={setSide}
          swap={swap}
          toggleCompare={toggleCompare}
          toggleHorizontal={toggleHorizontal}
          playing={playing}
          togglePlay={togglePlay}
        />
      </div>

      <div
        className={cn(
          'fixed right-3.5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[900] flex flex-col gap-2 transition-[right] duration-300 sm:bottom-9',
          panelOpen && 'sm:right-[calc(var(--pw)+38px)]',
        )}
        style={{ ['--pw' as string]: `${PANEL_WIDTH}px` }}
      >
        {map && (
          <ShareDialog
            map={map}
            state={state}
            ratio={ratio}
            labels={labels}
            inset={spot ? (mobile ? { right: 0, bottom: innerHeight * DRAWER_PEEK } : { right: PANEL_WIDTH + 24, bottom: 0 }) : { right: 0, bottom: 0 }}
            spotName={spot?.name ?? null}
          />
        )}
        <LayersMenu labels={labels} onLabels={setLabels} pins={pins} onPins={setPins} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="glass-strong rounded-xl"
              onClick={() => map?.locate({ enableHighAccuracy: true })}
              aria-label={t.map.myLocation}
            >
              <LocateFixed />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t.map.myLocation}</TooltipContent>
        </Tooltip>
        {(
          [
            [Plus, t.map.zoomIn, () => map?.zoomIn()],
            [Minus, t.map.zoomOut, () => map?.zoomOut()],
          ] as const
        ).map(([Icon, label, onClick]) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className="glass-strong rounded-xl max-[720px]:hidden"
                onClick={onClick}
                aria-label={label}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        ))}
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
            {t.map.loading} {loading.done}/{loading.total}
          </div>
        </div>
      )}

      <Toaster theme="dark" position={mobile ? 'top-center' : 'bottom-center'} />
    </>
  );
}
