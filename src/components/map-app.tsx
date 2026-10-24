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
import { PANEL_WIDTH, panelInset } from '@/components/PlacePanel';
import { ToolButton } from '@/components/Toolbar';
import { Toaster } from '@/components/ui/sonner';
import { YearControls } from '@/components/YearControls';
import { useIsMobile } from '@/hooks/use-mobile';
import { localePath } from '@/lib/i18n';
import { useTileLoading } from '@/lib/loading';
import { isInWarsaw } from '@/lib/site';
import { NO_SPOTS, publishMapState, publishSecondSide } from '@/lib/map-store';
import { spotIdFromPath, yearNumber, type Spot } from '@/lib/spots';
import { DEFAULT_STATE, START, mapStateToQuery, readCamera, readMapState, setSwipeSide, type MapCamera, type MapState, type Side } from '@/lib/state';
import { cn } from '@/lib/utils';
import { stepYear, YEAR_KEYS, type YearKey } from '@/lib/years';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#1a1b1e]" />,
});

const ShareDialog = dynamic(() => import('@/components/ShareDialog').then((m) => m.ShareDialog), {
  ssr: false,
  loading: () => <div className="h-11" />,
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

const PLAY_HOLD_MS = 2000;

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

  const secondSide = useSecondSidePins(map, spots, ratio, !!state.swipe, state.isHorizontal);
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

  const setYear = (year: YearKey) => {
    setIsPlaying(false);
    setState((s) => ({ ...s, year }));
  };
  const setSide = useCallback(
    (side: Side, year: YearKey) => setState((s) => (s.swipe ? { ...s, swipe: setSwipeSide(s.swipe, side, year) } : s)),
    [],
  );
  const toggleHorizontal = useCallback(() => setState((s) => ({ ...s, isHorizontal: !s.isHorizontal })), []);
  const swap = useCallback(() => setState((s) => (s.swipe ? { ...s, swipe: [s.swipe[1], s.swipe[0]] } : s)), []);
  const toggleCompare = useCallback(() => {
    setIsPlaying(false);
    setState((s) =>
      s.swipe ? { ...s, year: s.swipe[1], swipe: null } : { ...s, swipe: [s.year === 'today' ? '1935' : s.year, 'today'] },
    );
  }, []);
  const togglePlay = useCallback(() => {
    if (isPlaying) return setIsPlaying(false);
    setState((s) => ({ ...s, swipe: null, year: s.swipe || s.year === 'today' ? YEAR_KEYS[0] : s.year }));
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

  useEffect(() => {
    if (!isPlaying || isBusy) return;
    if (!nextYear) return setIsPlaying(false);
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, year: nextYear }));
      if (!stepYear(nextYear, 1)) setIsPlaying(false);
    }, PLAY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, isBusy, nextYear]);

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
          left={state.swipe ? state.swipe[0] : state.year}
          right={state.swipe ? state.swipe[1] : null}
          ahead={isPlaying ? (nextYear ?? null) : null}
          spots={spots}
          activeSpot={activeId}
          onSpot={openSpot}
          showLabels={showLabels}
          showPins={showPins}
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
          isHorizontal={state.isHorizontal}
          leftLabel={t.years[state.swipe[0]].label}
          rightLabel={t.years[state.swipe[1]].label}
          showHint={!hasSeenHint}
          onDragStart={dismissHint}
        />
      )}

      {map && <CoverageNotice map={map} years={state.swipe ?? [state.year]} />}

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
            showLabels={showLabels}
            inset={spot ? panelInset(isMobile) : { right: 0, bottom: 0 }}
          />
        )}
      </div>

      <div
        className={cn(isPanelOpen && 'sm:[&>nav]:-translate-x-[calc(var(--pw)/2)]')}
        style={{ ['--pw' as string]: `${PANEL_WIDTH + 12}px` }}
      >
        <YearControls
          state={state}
          setYear={setYear}
          setSide={setSide}
          swap={swap}
          toggleCompare={toggleCompare}
          toggleHorizontal={toggleHorizontal}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
        />
      </div>

      <div
        className={cn(
          'fixed right-3.5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[900] flex flex-col gap-2 transition-[right] duration-300 xl:bottom-9',
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
          <div className="glass-strong fixed top-14 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap text-foreground/85 tabular-nums sm:top-16">
            <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
            {t.map.loading} {loading.done}/{loading.total}
          </div>
        </div>
      )}

      <Toaster theme="dark" position={isMobile ? 'top-center' : 'bottom-center'} />
    </>
  );
}
