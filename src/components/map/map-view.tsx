import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Pane, useMap } from 'react-leaflet';

import { WARSAW_BBOX } from '@/lib/site';
import { hasPhotoNear, nearestPhoto, type Spot } from '@/lib/spots';
import { createLabelLayer } from '@/lib/wms';
import { MAX_ZOOM, MIN_ZOOM, type MapCamera } from '@/lib/state';
import { featherPx, yearDef, type YearKey } from '@/lib/years';
import { YearLayer } from './YearLayer';

const WARSAW_BOUNDS = L.latLngBounds([WARSAW_BBOX.south, WARSAW_BBOX.west], [WARSAW_BBOX.north, WARSAW_BBOX.east]);

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

const ATTRIBUTION_PREFIX = '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>';

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(spot: Spot, year: number, isActive: boolean) {
  const photo = nearestPhoto(spot, year);
  const isFaded = !hasPhotoNear(spot, year);
  const key = [spot.id, spot.name, photo.pin, isActive, isFaded].join('|');
  const cached = iconCache.get(key);
  if (cached) return cached;
  const classes = ['spot-pin', isActive && 'active', isFaded && 'faded', spot.kind === 'modern' && 'modern'];
  const icon = L.divIcon({
    className: classes.filter(Boolean).join(' '),
    html: `<span class="pin"><img src="${escapeHtml(photo.pin)}" alt="" draggable="false"></span><span class="pin-label">${escapeHtml(spot.name)}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  iconCache.set(key, icon);
  return icon;
}

interface PaneProps {
  pane: string;
}

function StreetLabels({ pane }: PaneProps) {
  const map = useMap();
  useEffect(() => {
    const layer = createLabelLayer(pane).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, pane]);
  return null;
}

const WORLD: L.LatLngTuple[] = [
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
];

interface CoverageMaskProps extends PaneProps {
  year: YearKey | null;
}

function CoverageMask({ pane, year }: CoverageMaskProps) {
  const map = useMap();
  useEffect(() => {
    if (!year) return;
    const renderer = L.svg({ pane, padding: 0.5 });
    const layer = L.polygon([WORLD, ...yearDef(year).outline], {
      pane,
      renderer,
      className: 'coverage-mask',
      interactive: false,
      smoothFactor: 0.5,
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
      map.removeLayer(renderer);
    };
  }, [map, pane, year]);
  return null;
}

function ZoomStyles() {
  const map = useMap();
  useEffect(() => {
    const sync = () => {
      const zoom = map.getZoom();
      const el = map.getContainer();
      el.style.setProperty('--feather', `${featherPx(zoom).toFixed(1)}px`);
      el.classList.toggle('pins-small', zoom >= 15 && zoom < 17);
      el.classList.toggle('pins-dots', zoom < 15);
    };
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [map]);
  return null;
}

interface MapViewProps {
  camera: MapCamera;
  left: YearKey;
  right: YearKey | null;
  ahead?: YearKey | null;
  spots: Spot[];
  activeSpot: string | null;
  onSpot(id: string): void;
  showLabels: boolean;
  showPins: boolean;
  years: [number] | [number, number];
  secondSide: ReadonlySet<string>;
  myLocation: L.LatLng | null;
  onMap(map: L.Map): void;
}

export function MapView({
  camera,
  left,
  right,
  ahead = null,
  spots,
  activeSpot,
  onSpot,
  showLabels,
  showPins,
  years,
  secondSide,
  myLocation,
  onMap,
}: MapViewProps) {
  const [first, second = first] = years;
  const icons = useMemo(
    () => new Map(spots.map((s) => [s.id, pinIcon(s, secondSide.has(s.id) ? second : first, s.id === activeSpot)])),
    [spots, activeSpot, first, second, secondSide],
  );

  return (
    <MapContainer
      ref={(m) => {
        if (!m) return;
        m.attributionControl.setPrefix(ATTRIBUTION_PREFIX);
        onMap(m);
      }}
      className="fixed! inset-0"
      center={[camera.lat, camera.lng]}
      zoom={camera.zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={WARSAW_BOUNDS.pad(0.05)}
      maxBoundsViscosity={1}
      zoomControl={false}
      attributionControl
    >
      <Pane name="yearLeft" style={{ zIndex: 250 }}>
        <YearLayer pane="yearLeft" year={left} ahead={ahead} />
        <CoverageMask pane="yearLeft" year={left} />
      </Pane>
      <Pane name="yearRight" style={{ zIndex: 251 }}>
        <YearLayer pane="yearRight" year={right} />
        <CoverageMask pane="yearRight" year={right} />
      </Pane>
      <Pane name="labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
        {showLabels && <StreetLabels pane="labels" />}
      </Pane>

      {spots.filter((s) => showPins || s.id === activeSpot).map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={icons.get(s.id)!}
          title={s.name}
          riseOnHover
          zIndexOffset={s.id === activeSpot ? 1000 : 0}
          eventHandlers={{ click: () => onSpot(s.id) }}
        />
      ))}

      {myLocation && (
        <CircleMarker
          center={myLocation}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}
        />
      )}
      <ZoomStyles />
    </MapContainer>
  );
}
