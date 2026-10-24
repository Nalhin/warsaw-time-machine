import type L from 'leaflet';
import { useSyncExternalStore } from 'react';

/**
 * Tile-loading progress across all year layers. Progress is recomputed from each layer's
 * internal tile list rather than by counting events: Leaflet aborts in-flight tiles on removal
 * without firing any event, so counters would drift.
 */
const tracked = new Set<L.TileLayer>();
const listeners = new Set<() => void>();
let snapshot = { total: 0, done: 0 };

function recompute() {
  let total = 0;
  let done = 0;
  for (const layer of tracked) {
    const tiles = (layer as any)._tiles as Record<string, { loaded?: number; current: boolean }>;
    for (const k in tiles) {
      if (!tiles[k].current) continue;
      total++;
      if (tiles[k].loaded) done++;
    }
  }
  if (total !== snapshot.total || done !== snapshot.done) {
    snapshot = { total, done };
    listeners.forEach((l) => l());
  }
}

export function trackLayer(layer: L.TileLayer) {
  tracked.add(layer);
  layer.on('tileloadstart tileload tileerror load', recompute);
  layer.on('remove', () => {
    tracked.delete(layer);
    recompute();
  });
}

export function useTileLoading() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}
