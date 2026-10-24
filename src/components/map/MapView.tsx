import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Pane, ZoomControl, useMap } from 'react-leaflet';

import type { Spot } from '@/lib/spots';
import { createLabelLayer } from '@/lib/wms';
import { yearDef, type YearKey } from '@/lib/years';
import { YearLayer } from './YearLayer';

export const WARSAW_BOUNDS = L.latLngBounds([52.07, 20.82], [52.39, 21.29]);
const START: L.LatLngTuple = [52.2445, 21.0122];

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const CAMERA_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

function pinIcon(name: string, active: boolean) {
  return L.divIcon({
    className: `spot-pin${active ? ' active' : ''}`,
    html: `<span class="pin">${CAMERA_SVG}</span><span class="pin-label">${escapeHtml(name)}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
      const px = Math.min(24, Math.max(3, 3 * 2 ** ((map.getZoom() - 11) / 2)));
      map.getContainer().style.setProperty('--feather', `${px.toFixed(1)}px`);
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
  left,
  right,
  spots,
  activeSpot,
  onSpot,
  showLabels,
  myLocation,
  onMap,
}: {
  left: YearKey;
  right: YearKey | null;
  spots: Spot[];
  activeSpot: string | null;
  onSpot(id: string): void;
  showLabels: boolean;
  myLocation: L.LatLng | null;
  onMap(map: L.Map): void;
}) {
  const icons = useMemo(
    () => new Map(spots.map((s) => [s.id, pinIcon(s.name, s.id === activeSpot)])),
    [spots, activeSpot],
  );

  return (
    <MapContainer
      ref={(m) => {
        if (m) onMap(m);
      }}
      className="fixed! inset-0"
      center={START}
      zoom={16}
      minZoom={11}
      maxZoom={20}
      maxBounds={WARSAW_BOUNDS.pad(0.05)}
      maxBoundsViscosity={1}
      zoomControl={false}
      attributionControl
    >
      <ZoomControl position="bottomright" zoomInTitle="Zoom in" zoomOutTitle="Zoom out" />
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

      {spots.map((s) => (
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
