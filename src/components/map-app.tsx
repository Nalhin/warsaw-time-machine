'use client';

import type L from 'leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { AboutDialog } from '@/components/about-dialog';
import { LanguageSwitch } from '@/components/language-switch';
import { LayersMenu } from '@/components/layers-menu';
import { useLocale, useMessages } from '@/components/locale-provider';
import { CoverageNotice } from '@/components/map/coverage-notice';
import { SwipeDivider } from '@/components/map/swipe-divider';
import { PANEL_WIDTH, panelInset } from '@/components/place-panel';
import { ToolButton } from '@/components/toolbar';
import { Toaster } from '@/components/ui/sonner';
import { YearControls } from '@/components/year-controls';
import { useIsMobile } from '@/hooks/use-mobile';
import { localePath } from '@/lib/i18n';
import { useTileLoading } from '@/lib/loading';
import { isInWarsaw } from '@/lib/site';
import { NO_SPOTS, publishMapState, publishSecondSide } from '@/lib/map-store';
import { spotIdFromPath, yearNumber, type Spot } from '@/lib/spots';
import {
  DEFAULT_STATE,
  DEFAULT_SWIPE,
  PLAY_FADE_RATIO,
  PLAY_HOLD_MS,
  START,
  mapStateToQuery,
  readCamera,
  readMapState,
  setSwipeSide,
  shownYears,
  type MapCamera,
  type MapState,
  type PlaybackSpeed,
  type Side,
  type ViewMode,
} from '@/lib/state';
import { cn } from '@/lib/utils';
import { stepYear, YEAR_KEYS, type YearKey } from '@/lib/years';

const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#1a1b1e]" />,
});

const ShareDialog = dynamic(() => import('@/components/share-dialog').then((m) => m.ShareDialog), {
  ssr: false,
  loading: () => <div className="h-[42px]" />,
});

const HINT_KEY = 'wtm-dragged';

function useSecondSidePins(map: L.Map | null, spots: Spot[], ratio: number, isSwiping: boolean, isHorizontal: boolean) {
  const [ids, setIds] = useState(NO_SPOTS);
  useEffect(() => {
    if (!map || !isSwiping) return setIds(NO_SPOTS);
    const update = () => {
      const size = map.getSize();
      const split = (isHorizontal ? size.y : size.x) * ratio;
      const next = spots
        .filter((s) => {
          const p = map.latLngToContainerPoint([s.lat, s.lng]);
          return (isHorizontal ? p.y : p.x) >= split;
        })
        .map((s) => s.id);
      setIds((prev) => (prev.size === next.length && next.every((id) => prev.has(id)) ? prev : new Set(next)));
    };
    update();
    map.on('move zoomend viewreset resize', update);
    return () => {
      map.off('move zoomend viewreset resize', update);
    };
  }, [map, spots, ratio, isSwiping, isHorizontal]);
  return ids;
}

const STEP_FADE_MS = 450;
const PRELOAD_YEARS = 3;

interface MapAppProps {
  spots: Spot[];
}

export function MapApp({ spots }: MapAppProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages();
  const pathname = usePathname();
  const activeId = spotIdFromPath(pathname);
  const spot = spots.find((s) => s.id === activeId) ?? null;

  const [state, setState] = useState<MapState>(DEFAULT_STATE);
  const [camera, setCamera] = useState<MapCamera | null>(null);
  const [initialCamera, setInitialCamera] = useState<MapCamera>(START);
  const [isReady, setIsReady] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [ratio, setRatio] = useState(0.5);
  const [hasSeenHint, setHasSeenHint] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [me, setMe] = useState<L.LatLng | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const isMobile = useIsMobile();

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
      setHasSeenHint(localStorage.getItem(HINT_KEY) === '1');
    } catch {
      setHasSeenHint(false);
    }
    setIsReady(true);
  }, []);

  useEffect(() => publishMapState(state), [state]);

  const isComparing = state.mode === 'compare';
  const secondSide = useSecondSidePins(map, spots, ratio, isComparing, state.isHorizontal);
  useEffect(() => publishSecondSide(secondSide), [secondSide]);

  useEffect(() => {
    if (!isReady) return;
    const url = `${location.pathname}${mapStateToQuery(state, camera)}`;
    if (url !== `${location.pathname}${location.search}`) history.replaceState(history.state, '', url);
  }, [state, camera, isReady, pathname]);

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

  const setYear = useCallback((year: YearKey) => setState((s) => ({ ...s, year })), []);
  const setSide = useCallback((side: Side, year: YearKey) => setState((s) => ({ ...s, swipe: setSwipeSide(s.swipe, side, year) })), []);
  const toggleHorizontal = useCallback(() => setState((s) => ({ ...s, isHorizontal: !s.isHorizontal })), []);
  const swap = useCallback(() => setState((s) => ({ ...s, swipe: [s.swipe[1], s.swipe[0]] })), []);
  const setMode = useCallback(
    (mode: ViewMode) => {
      if (mode === state.mode) return;
      setIsPlaying(false);
      setState((s) => {
        if (mode === 'compare') return { ...s, mode, swipe: [s.year === 'today' ? DEFAULT_SWIPE[0] : s.year, 'today'] };
        if (mode === 'timelapse') return { ...s, mode, year: YEAR_KEYS[0] };
        return { ...s, mode, year: s.mode === 'compare' ? s.swipe[1] : s.year };
      });
    },
    [state.mode],
  );
  const togglePlay = useCallback(() => {
    if (isPlaying) return setIsPlaying(false);
    setState((s) => (stepYear(s.year, 1) ? s : { ...s, year: YEAR_KEYS[0] }));
    setIsPlaying(true);
  }, [isPlaying]);

  const openSpot = (id: string) => router.push(`${localePath(locale, `/spots/${id}`)}${location.search}`, { scroll: false });

  useEffect(() => {
    if (!map || !spot || flown.current === spot.id) return;
    const isFirstFlight = flown.current === null;
    flown.current = spot.id;
    const covered = panelInset(isMobile);
    const zoom = Math.max(isFirstFlight ? 17 : map.getZoom(), 16);
    const target = map.unproject(map.project([spot.lat, spot.lng], zoom).add([covered.right / 2, covered.bottom / 2]), zoom);
    if (isFirstFlight) map.setView(target, zoom, { animate: false });
    else if (zoom === map.getZoom()) map.panTo(target, { duration: 0.6 });
    else map.flyTo(target, zoom, { duration: 0.8 });
  }, [map, spot, isMobile]);
  useEffect(() => {
    if (!spot) flown.current = '';
  }, [spot]);

  useEffect(() => {
    if (!map) return;
    const found = (e: L.LocationEvent) => {
      const { lat, lng } = e.latlng;
      if (!isInWarsaw(lat, lng)) return void toast(t.map.outsideWarsaw);
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

  const isPanelOpen = !!spot && !isMobile;
  useEffect(() => {
    document.documentElement.classList.toggle('panel-open', isPanelOpen);
  }, [isPanelOpen]);

  const loading = useTileLoading();
  const isBusy = loading.total > 0 && loading.done < loading.total;
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!isBusy) return setShowLoading(false);
    const t = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(t);
  }, [isBusy]);

  const nextYear = stepYear(state.year, 1);
  const holdMs = PLAY_HOLD_MS / speed;
  const preloadYears =
    state.mode === 'timelapse' ? YEAR_KEYS.slice(YEAR_KEYS.indexOf(state.year) + 1).slice(0, PRELOAD_YEARS) : [];
  const fadeMs = isPlaying ? Math.round(holdMs * PLAY_FADE_RATIO) : STEP_FADE_MS;

  useEffect(() => {
    if (!isPlaying || isBusy) return;
    if (!nextYear) return setIsPlaying(false);
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, year: nextYear }));
      if (!stepYear(nextYear, 1)) setIsPlaying(false);
    }, holdMs);
    return () => clearTimeout(timer);
  }, [isPlaying, isBusy, nextYear, holdMs]);

  const dismissHint = () => {
    if (hasSeenHint) return;
    setHasSeenHint(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {}
  };

  const tools = [
    { icon: Plus, label: t.map.zoomIn, onClick: () => map?.zoomIn() },
    { icon: Minus, label: t.map.zoomOut, onClick: () => map?.zoomOut() },
  ];

  return (
    <>
      {isReady ? (
        <MapView
          camera={initialCamera}
          left={isComparing ? state.swipe[0] : state.year}
          right={isComparing ? state.swipe[1] : null}
          ahead={preloadYears}
          fadeMs={fadeMs}
          spots={spots}
          activeSpot={activeId}
          onSpot={openSpot}
          showLabels={showLabels}
          showPins={showPins}
          years={isComparing ? [yearNumber(state.swipe[0]), yearNumber(state.swipe[1])] : [yearNumber(state.year)]}
          secondSide={secondSide}
          myLocation={me}
          onMap={setMap}
        />
      ) : (
        <div className="fixed inset-0 bg-[#1a1b1e]" />
      )}

      {map && isComparing && (
        <SwipeDivider
          map={map}
          ratio={ratio}
          onRatio={setRatio}
          isHorizontal={state.isHorizontal}
          leftLabel={t.years[state.swipe[0]].label}
          rightLabel={t.years[state.swipe[1]].label}
          showHint={!hasSeenHint}
          onDragStart={dismissHint}
        />
      )}

      {map && <CoverageNotice map={map} years={shownYears(state)} />}

      <AboutDialog />

      <div
        className={cn(
          'fixed top-[calc(12px+env(safe-area-inset-top))] right-3 z-[1000] transition-[right] duration-300',
          isPanelOpen && 'sm:right-[calc(var(--pw)+38px)]',
        )}
        style={{ ['--pw' as string]: `${PANEL_WIDTH}px` }}
      >
        {map && (
          <ShareDialog
            map={map}
            state={state}
            ratio={ratio}
            speed={speed}
            showLabels={showLabels}
            inset={spot ? panelInset(isMobile) : { right: 0, bottom: 0 }}
          />
        )}
      </div>

      <div
        className={cn(
          isPanelOpen && 'sm:[&>nav]:max-w-[min(48rem,calc(100%-var(--pw)-20px))] sm:[&>nav]:-translate-x-[calc(var(--pw)/2)]',
        )}
        style={{ ['--pw' as string]: `${PANEL_WIDTH + 12}px` }}
      >
        {isReady && (
          <YearControls
            state={state}
            setMode={setMode}
            setYear={setYear}
            setSide={setSide}
            swap={swap}
            toggleHorizontal={toggleHorizontal}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            speed={speed}
            setSpeed={setSpeed}
            progressMs={isPlaying && !isBusy && nextYear ? holdMs : null}
          />
        )}
      </div>

      <div
        className={cn(
          'fixed right-3.5 bottom-[calc(130px+env(safe-area-inset-bottom))] z-[900] flex flex-col gap-2 transition-[right] duration-300 xl:bottom-9',
          isPanelOpen && 'sm:right-[calc(var(--pw)+38px)]',
        )}
        style={{ ['--pw' as string]: `${PANEL_WIDTH}px` }}
      >
        <LanguageSwitch />
        <LayersMenu showLabels={showLabels} onShowLabelsChange={setShowLabels} showPins={showPins} onShowPinsChange={setShowPins} />
        <ToolButton label={t.map.myLocation} onClick={() => map?.locate({ enableHighAccuracy: true })}>
          <LocateFixed />
        </ToolButton>
        {tools.map(({ icon: Icon, label, onClick }) => (
          <ToolButton key={label} label={label} onClick={onClick} className="hidden min-[721px]:inline-flex">
            <Icon />
          </ToolButton>
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
          <div className="glass-strong fixed top-14 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap text-foreground/85 tabular-nums sm:top-16 xl:top-28">
            <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
            {t.map.loading} {loading.done}/{loading.total}
          </div>
        </div>
      )}

      <Toaster theme="dark" position={isMobile ? 'top-center' : 'bottom-center'} />
    </>
  );
}
