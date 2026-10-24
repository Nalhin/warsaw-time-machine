import type L from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

import { useMessages } from '@/components/locale-provider';
import { trackLayer } from '@/lib/loading';
import { createYearLayer } from '@/lib/wms';
import type { YearKey } from '@/lib/years';

interface LayerEntry {
  key: YearKey;
  layer: L.TileLayer;
}

interface LayerSlots {
  current: LayerEntry | null;
  pending: LayerEntry | null;
  ahead: LayerEntry | null;
  z: number;
}

interface YearLayerProps {
  pane: string;
  year: YearKey | null;
  ahead?: YearKey | null;
}

export function YearLayer({ pane, year, ahead = null }: YearLayerProps) {
  const map = useMap();
  const t = useMessages();
  const slot = useRef<LayerSlots>({ current: null, pending: null, ahead: null, z: 1 });

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

    const preloaded = s.ahead?.key === year ? s.ahead.layer : null;
    if (preloaded) s.ahead = null;
    const layer = (preloaded ?? createYearLayer(year, pane, { label: t.about.aerial, owner: t.about.city }))
      .setOpacity(1)
      .setZIndex(++s.z);
    trackLayer(layer);
    const entry = { key: year, layer };
    const promote = () => {
      if (s.pending !== entry) return;
      if (s.current) map.removeLayer(s.current.layer);
      s.current = entry;
      s.pending = null;
    };
    if (!s.current) s.current = entry;
    else {
      s.pending = entry;
      layer.once('load', promote);
    }
    if (!preloaded) layer.addTo(map);
    if (!layer.isLoading()) promote();
  }, [map, pane, year, t]);

  useEffect(() => {
    const s = slot.current;
    if (s.ahead && s.ahead.key !== ahead) {
      map.removeLayer(s.ahead.layer);
      s.ahead = null;
    }
    if (!ahead || ahead === year || s.ahead || s.current?.key === ahead || s.pending?.key === ahead) return;
    const layer = createYearLayer(ahead, pane, { label: t.about.aerial, owner: t.about.city }).setOpacity(0).setZIndex(0);
    s.ahead = { key: ahead, layer };
    layer.addTo(map);
  }, [map, pane, year, ahead, t]);

  useEffect(
    () => () => {
      const s = slot.current;
      for (const e of [s.current, s.pending, s.ahead]) if (e) map.removeLayer(e.layer);
      s.current = s.pending = s.ahead = null;
    },
    [map],
  );

  return null;
}
