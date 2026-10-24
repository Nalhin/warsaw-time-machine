import type L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

import { trackLayer } from '@/lib/loading';
import { createYearLayer, type YearKey } from '@/lib/years';

/**
 * The aerial photo for one year in one pane (or nothing when `year` is null).
 * On a change the new layer loads on top of the old one, and the old layer is removed only when
 * the new one has finished, so the map never goes blank while the slow WMS catches up.
 */
export function YearLayer({ pane, year }: { pane: string; year: YearKey | null }) {
  const map = useMap();
  const slot = useRef<{
    current: { key: YearKey; layer: L.TileLayer } | null;
    pending: { key: YearKey; layer: L.TileLayer } | null;
    z: number;
  }>({ current: null, pending: null, z: 1 });

  useEffect(() => {
    const s = slot.current;
    if (s.pending && s.pending.key !== year) {
      map.removeLayer(s.pending.layer);
      s.pending = null;
    }
    if (year === null) {
      if (s.current) map.removeLayer(s.current.layer);
      s.current = null;
      return;
    }
    if (s.current?.key === year || s.pending?.key === year) return;

    const layer = createYearLayer(year, pane).setZIndex(++s.z);
    trackLayer(layer);
    const entry = { key: year, layer };
    if (!s.current) {
      s.current = entry;
    } else {
      s.pending = entry;
      layer.once('load', () => {
        if (s.pending !== entry) return;
        if (s.current) map.removeLayer(s.current.layer);
        s.current = entry;
        s.pending = null;
      });
    }
    layer.addTo(map);
  }, [map, pane, year]);

  // Remove everything on unmount.
  useEffect(
    () => () => {
      const s = slot.current;
      for (const e of [s.current, s.pending]) if (e) map.removeLayer(e.layer);
      s.current = s.pending = null;
    },
    [map],
  );

  return null;
}
