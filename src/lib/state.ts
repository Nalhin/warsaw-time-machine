import { WARSAW_BBOX } from './site';
import { parseYear, type YearKey } from './years';

export interface MapState {
  year: YearKey;
  swipe: [YearKey, YearKey] | null;
  horizontal: boolean;
}

export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

export const DEFAULT_SWIPE: [YearKey, YearKey] = ['1935', 'today'];
export const DEFAULT_STATE: MapState = { year: '1935', swipe: DEFAULT_SWIPE, horizontal: false };
export const START: MapCamera = { lat: 52.2445, lng: 21.0122, zoom: 16 };
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 20;

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
  const divider = q.get('divider')?.trim().toLowerCase();
  return { year: year ?? '1935', swipe, horizontal: divider === 'horizontal' || divider === 'h' };
}

export function readCamera(search: string): MapCamera | null {
  const at = new URLSearchParams(search).get('at');
  if (!at) return null;
  const [lat, lng, zoom] = at.split(',').map(Number);
  const b = WARSAW_BBOX;
  if (![lat, lng, zoom].every(Number.isFinite)) return null;
  if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return null;
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
  if (s.swipe && s.horizontal) parts.push('divider=horizontal');
  if (camera) parts.push(`at=${formatCamera(camera)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
