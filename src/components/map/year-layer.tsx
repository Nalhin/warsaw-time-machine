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
  ahead: Map<YearKey, L.TileLayer>;
  leaving: Map<L.TileLayer, ReturnType<typeof setTimeout>>;
  fill(): void;
  z: number;
}

interface YearLayerProps {
  pane: string;
  year: YearKey | null;
  ahead?: YearKey[];
  fadeMs: number;
}

const NO_YEARS: YearKey[] = [];

export function YearLayer({ pane, year, ahead = NO_YEARS, fadeMs }: YearLayerProps) {
  const map = useMap();
  const t = useMessages();
  const slot = useRef<LayerSlots>({ current: null, pending: null, ahead: new Map(), leaving: new Map(), fill: () => {}, z: 1 });
  const fade = useRef(fadeMs);
  fade.current = fadeMs;
  const aheadKey = ahead.join(',');

  useEffect(() => {
    const s = slot.current;
    const retire = (layer: L.TileLayer) => {
      const timer = setTimeout(() => {
        s.leaving.delete(layer);
        map.removeLayer(layer);
      }, fade.current + 50);
      s.leaving.set(layer, timer);
    };
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

    const preloaded = s.ahead.get(year) ?? null;
    s.ahead.delete(year);
    const layer = preloaded ?? createYearLayer(year, pane, { label: t.about.aerial, owner: t.about.city }).setOpacity(0);
    layer.setZIndex(++s.z);
    trackLayer(layer);
    const entry = { key: year, layer };
    const reveal = () => {
      if (s.pending !== entry) return;
      if (s.current) retire(s.current.layer);
      s.current = entry;
      s.pending = null;
      layer.setOpacity(1);
      s.fill();
    };
    if (!s.current) {
      s.current = entry;
      layer.setOpacity(1);
    } else {
      s.pending = entry;
      layer.once('load', reveal);
    }
    if (!preloaded) layer.on('load', () => s.fill()).addTo(map);
    if (!layer.isLoading()) reveal();
  }, [map, pane, year, t]);

  useEffect(() => {
    const s = slot.current;
    const wanted = aheadKey ? (aheadKey.split(',') as YearKey[]) : NO_YEARS;
    for (const [key, layer] of s.ahead) {
      if (wanted.includes(key)) continue;
      map.removeLayer(layer);
      s.ahead.delete(key);
    }
    s.fill = () => {
      if (s.pending?.layer.isLoading() || s.current?.layer.isLoading()) return;
      if ([...s.ahead.values()].some((l) => l.isLoading())) return;
      const key = wanted.find((k) => k !== s.current?.key && k !== s.pending?.key && !s.ahead.has(k));
      if (!key) return;
      const layer = createYearLayer(key, pane, { label: t.about.aerial, owner: t.about.city }).setOpacity(0).setZIndex(0);
      s.ahead.set(key, layer);
      layer.on('load', () => s.fill());
      layer.addTo(map);
      if (!layer.isLoading()) s.fill();
    };
    s.fill();
  }, [map, pane, aheadKey, t]);

  useEffect(
    () => () => {
      const s = slot.current;
      for (const e of [s.current, s.pending]) if (e) map.removeLayer(e.layer);
      for (const layer of s.ahead.values()) map.removeLayer(layer);
      for (const [layer, timer] of s.leaving) {
        clearTimeout(timer);
        map.removeLayer(layer);
      }
      s.ahead.clear();
      s.leaving.clear();
      s.current = s.pending = null;
      s.fill = () => {};
    },
    [map],
  );

  return null;
}
