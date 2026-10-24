import { isInWarsaw } from './site';
import { otherYear, parseYear, type YearKey } from './years';

export type Side = 0 | 1;
export type SwipeYears = [YearKey, YearKey];
export type ViewMode = 'compare' | 'year' | 'timelapse';

export const VIEW_MODES: ViewMode[] = ['compare', 'year', 'timelapse'];
export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export const PLAY_HOLD_MS = 2000;
export const PLAY_FADE_RATIO = 0.4;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface MapState {
  mode: ViewMode;
  year: YearKey;
  swipe: SwipeYears;
  isHorizontal: boolean;
}

export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

export const DEFAULT_SWIPE: SwipeYears = ['1945', 'today'];
export const DEFAULT_STATE: MapState = { mode: 'compare', year: '1935', swipe: DEFAULT_SWIPE, isHorizontal: false };
export const START: MapCamera = { lat: 52.2445, lng: 21.0122, zoom: 16 };
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 20;

export function setSwipeSide(years: SwipeYears, side: Side, year: YearKey): SwipeYears {
  const next: SwipeYears = [...years];
  if (next[1 - side] === year) next[1 - side] = next[side];
  next[side] = year;
  return next;
}

export function shownYears(s: MapState): [YearKey] | SwipeYears {
  return s.mode === 'compare' ? s.swipe : [s.year];
}

function readPair(value: string): SwipeYears {
  const [a, b] = value.split('-').map(parseYear);
  const left = a ?? DEFAULT_SWIPE[0];
  const right = b && b !== left ? b : otherYear(left);
  return [left, right];
}

export function readMapState(search: string): MapState {
  const q = new URLSearchParams(search);
  const timelapse = q.get('timelapse');
  const year = parseYear(timelapse ?? q.get('year'));
  const compare = q.get('compare');
  const mode: ViewMode = timelapse !== null ? 'timelapse' : year ? 'year' : 'compare';
  return {
    mode,
    year: year ?? DEFAULT_STATE.year,
    swipe: compare ? readPair(compare) : [...DEFAULT_SWIPE],
    isHorizontal: q.get('divider') === 'h',
  };
}

export function readCamera(search: string): MapCamera | null {
  const at = new URLSearchParams(search).get('at');
  if (!at) return null;
  const [lat, lng, zoom] = at.split(',').map(Number);
  if (![lat, lng, zoom].every(Number.isFinite) || !isInWarsaw(lat, lng)) return null;
  return { lat, lng, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) };
}

export function formatCamera({ lat, lng, zoom }: MapCamera): string {
  const digits = zoom >= 17 ? 6 : zoom >= 13 ? 5 : 4;
  return [lat.toFixed(digits), lng.toFixed(digits), zoom.toFixed(2)].map(Number).join(',');
}

export function mapStateToQuery(s: MapState, camera: MapCamera | null = null): string {
  const parts: string[] = [];
  if (s.mode === 'timelapse') parts.push(`timelapse=${s.year}`);
  if (s.mode === 'year') parts.push(`year=${s.year}`);
  if (s.mode === 'compare' && s.swipe.join() !== DEFAULT_SWIPE.join()) parts.push(`compare=${s.swipe.join('-')}`);
  if (s.mode === 'compare' && s.isHorizontal) parts.push('divider=h');
  if (camera) parts.push(`at=${formatCamera(camera)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
