import { parseYear, type YearKey } from './years';

export interface MapState {
  year: YearKey;
  swipe: [YearKey, YearKey] | null;
}

export const DEFAULT_SWIPE: [YearKey, YearKey] = ['1935', 'today'];
export const DEFAULT_STATE: MapState = { year: '1935', swipe: DEFAULT_SWIPE };

export function readMapState(search: string): MapState {
  const q = new URLSearchParams(search);
  const year = parseYear(q.get('year'));
  let swipe: MapState['swipe'] = null;
  const sw = q.get('swipe');
  if (sw !== null) {
    const [a, b] = sw.split(',').map(parseYear);
    swipe = [a ?? '1935', b ?? (a === 'today' ? '1935' : 'today')];
    if (swipe[0] === swipe[1]) swipe[1] = swipe[0] === 'today' ? '1935' : 'today';
  } else if (!year) {
    swipe = [...DEFAULT_SWIPE];
  }
  return { year: year ?? '1935', swipe };
}

export function mapStateToQuery(s: MapState): string {
  if (s.swipe) return s.swipe.join() === DEFAULT_SWIPE.join() ? '' : `?swipe=${s.swipe.join(',')}`;
  return `?year=${s.year}`;
}
