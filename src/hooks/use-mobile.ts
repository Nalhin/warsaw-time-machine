import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 720px)';

export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => matchMedia(QUERY).matches,
    () => false,
  );
}
