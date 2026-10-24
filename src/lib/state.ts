import { isInWarsaw } from './site';
import { otherYear, parseYear, type YearKey } from './years';

export type Side = 0 | 1;
export type SwipeYears = [YearKey, YearKey];

export interface MapState {
  year: YearKey;
  swipe: SwipeYears | null;
  isHorizontal: boolean;
}

export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

export const DEFAULT_SWIPE: SwipeYears = ['1935', 'today'];
export const DEFAULT_STATE: MapState = { year: '1935', swipe: DEFAULT_SWIPE, isHorizontal: false };
export const START: MapCamera = { lat: 52.2445, lng: 21.0122, zoom: 16 };
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 20;

export function setSwipeSide(years: SwipeYears, side: Side, year: YearKey): SwipeYears {
  const next: SwipeYears = [...years];
  if (next[1 - side] === year) next[1 - side] = next[side];
  next[side] = year;
  return next;
}

export function readMapState(search: string): MapState {
  const q = new URLSearchParams(search);
  const year = parseYear(q.get('year'));
  let swipe: MapState['swipe'] = null;
  const sw = q.get('swipe');
  if (sw !== null) {
    const [a, b] = sw.split(',').map(parseYear);
    swipe = [a ?? '1935', b ?? otherYear(a)];
    if (swipe[0] === swipe[1]) swipe[1] = otherYear(swipe[0]);
  } else if (!year) swipe = [...DEFAULT_SWIPE];
  const divider = q.get('divider')?.trim().toLowerCase();
  return { year: year ?? '1935', swipe, isHorizontal: divider === 'horizontal' || divider === 'h' };
}

export function readCamera(search: string): MapCamera | null {
  const at = new URLSearchParams(search).get('at');
  if (!at) return null;
  const [lat, lng, zoom] = at.split(',').map(Number);
  if (![lat, lng, zoom].every(Number.isFinite) || !isInWarsaw(lat, lng)) return null;
  return { lat, lng, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) };
}

export function formatCamera({ lat, lng, zoom }: MapCamera): string {
  const digits = zoom >= 17 ? 6 : 5;
  return `${lat.toFixed(digits)},${lng.toFixed(digits)},${Number(zoom.toFixed(2))}`;
}

export function mapStateToQuery(s: MapState, camera: MapCamera | null = null): string {
  const parts: string[] = [];
  if (!s.swipe) parts.push(`year=${s.year}`);
  else if (s.swipe.join() !== DEFAULT_SWIPE.join()) parts.push(`swipe=${s.swipe.join(',')}`);
  if (s.swipe && s.isHorizontal) parts.push('divider=horizontal');
  if (camera) parts.push(`at=${formatCamera(camera)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
