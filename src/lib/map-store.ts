import { useSyncExternalStore } from 'react';

import { DEFAULT_STATE, type MapState } from './state';

let current: MapState = DEFAULT_STATE;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function publishMapState(state: MapState) {
  if (state === current) return;
  current = state;
  listeners.forEach((fn) => fn());
}

export const useMapState = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_STATE,
  );
