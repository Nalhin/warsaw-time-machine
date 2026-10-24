import type L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

import { trackLayer } from '@/lib/loading';
import { createYearLayer } from '@/lib/wms';
import type { YearKey } from '@/lib/years';

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
    const promote = () => {
      if (s.pending !== entry) return;
      if (s.current) map.removeLayer(s.current.layer);
      s.current = entry;
      s.pending = null;
    };
    if (!s.current) {
      s.current = entry;
    } else {
      s.pending = entry;
      layer.once('load', promote);
    }
    layer.addTo(map);
    if (!layer.isLoading()) promote();
  }, [map, pane, year]);

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
