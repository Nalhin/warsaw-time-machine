import type L from 'leaflet';
import { useSyncExternalStore } from 'react';

const tracked = new Set<L.TileLayer>();
const listeners = new Set<() => void>();
const EMPTY = { total: 0, done: 0 };
let snapshot = EMPTY;

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
    () => EMPTY,
  );
}
