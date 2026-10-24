import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Pane, useMap } from 'react-leaflet';

import { hasPhotoNear, nearestPhoto, type Spot } from '@/lib/spots';
import { createLabelLayer } from '@/lib/wms';
import { MAX_ZOOM, MIN_ZOOM, type MapCamera } from '@/lib/state';
import { featherPx, yearDef, type YearKey } from '@/lib/years';
import { YearLayer } from './YearLayer';

export const WARSAW_BOUNDS = L.latLngBounds([52.07, 20.82], [52.39, 21.29]);

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const ATTRIBUTION_PREFIX = '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>';

function pinIcon(spot: Spot, year: number, active: boolean) {
  const photo = nearestPhoto(spot, year);
  const classes = ['spot-pin', active && 'active', !hasPhotoNear(spot, year) && 'faded', spot.kind === 'modern' && 'modern'];
  return L.divIcon({
    className: classes.filter(Boolean).join(' '),
    html: `<span class="pin"><img src="${escapeHtml(photo.pin)}" alt="" draggable="false"></span><span class="pin-label">${escapeHtml(spot.name)}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function StreetLabels({ pane }: { pane: string }) {
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

function CoverageMask({ pane, year }: { pane: string; year: YearKey | null }) {
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

function FeatherZoom() {
  const map = useMap();
  useEffect(() => {
    const sync = () => {
      map.getContainer().style.setProperty('--feather', `${featherPx(map.getZoom()).toFixed(1)}px`);
    };
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [map]);
  return null;
}

function PinLabelZoom() {
  const map = useMap();
  useEffect(() => {
    const sync = () => map.getContainer().classList.toggle('pin-labels', map.getZoom() >= 16);
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [map]);
  return null;
}

export function MapView({
  camera,
  left,
  right,
  spots,
  activeSpot,
  onSpot,
  showLabels,
  showPins,
  year,
  myLocation,
  onMap,
}: {
  camera: MapCamera;
  left: YearKey;
  right: YearKey | null;
  spots: Spot[];
  activeSpot: string | null;
  onSpot(id: string): void;
  showLabels: boolean;
  showPins: boolean;
  year: number;
  myLocation: L.LatLng | null;
  onMap(map: L.Map): void;
}) {
  const icons = useMemo(
    () => new Map(spots.map((s) => [s.id, pinIcon(s, year, s.id === activeSpot)])),
    [spots, activeSpot, year],
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
        <YearLayer pane="yearLeft" year={left} />
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
      <PinLabelZoom />
      <FeatherZoom />
    </MapContainer>
  );
}
