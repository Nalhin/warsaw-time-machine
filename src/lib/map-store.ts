import { useSyncExternalStore } from 'react';

import { DEFAULT_STATE, type MapState } from './state';

function createStore<T>(initial: T) {
  let current = initial;
  const listeners = new Set<() => void>();
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };
  return {
    publish(next: T) {
      if (next === current) return;
      current = next;
      listeners.forEach((fn) => fn());
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => current,
        () => initial,
      ),
  };
}

const mapState = createStore<MapState>(DEFAULT_STATE);
export const publishMapState = mapState.publish;
export const useMapState = mapState.use;

export const NO_SPOTS: ReadonlySet<string> = new Set();
const secondSide = createStore(NO_SPOTS);
export const publishSecondSide = secondSide.publish;
export const useSecondSide = secondSide.use;
