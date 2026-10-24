import { parseYear, type YearKey } from './years';

export interface AppState {
  year: YearKey;
  /** [left, right] when compare mode is on. */
  swipe: [YearKey, YearKey] | null;
  spot: string | null;
}

/** With no parameters the map opens comparing 1935 with today. */
export const DEFAULT_SWIPE: [YearKey, YearKey] = ['1935', 'today'];

export function readUrlState(search = location.search): AppState {
  const q = new URLSearchParams(search);
  const year = parseYear(q.get('year'));
  let swipe: AppState['swipe'] = null;
  const sw = q.get('swipe');
  if (sw !== null) {
    const [a, b] = sw.split(',').map(parseYear);
    swipe = [a ?? '1935', b ?? (a === 'today' ? '1935' : 'today')];
    if (swipe[0] === swipe[1]) swipe[1] = swipe[0] === 'today' ? '1935' : 'today';
  } else if (!year) {
    swipe = [...DEFAULT_SWIPE];
  }
  return { year: year ?? '1935', swipe, spot: q.get('spot') || null };
}

export function stateToQuery(s: AppState): string {
  // Built by hand so the comma in ?swipe=1935,today isn't percent-encoded.
  const parts: string[] = [];
  if (s.swipe) {
    if (s.swipe.join() !== DEFAULT_SWIPE.join()) parts.push(`swipe=${s.swipe.join(',')}`);
  } else {
    parts.push(`year=${s.year}`);
  }
  if (s.spot) parts.push(`spot=${encodeURIComponent(s.spot)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function writeUrlState(s: AppState) {
  const url = `${location.pathname}${stateToQuery(s)}${location.hash}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
}
