import { DEFAULT_LOCALE, type Locale } from './i18n';
import { DEFAULT_SWIPE, mapStateToQuery, readCamera, readMapState, START, type MapCamera, type SwipeYears } from './state';
import { YEAR_KEYS, yearDef, type YearKey } from './years';

export interface OgScene {
  camera: MapCamera;
  years: [YearKey] | SwipeYears;
  isHorizontal: boolean;
  query: string;
}

function coversPoint(key: YearKey, { lat, lng }: MapCamera) {
  const [[south, west], [north, east]] = yearDef(key).coverage;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function timelapseEnds(camera: MapCamera): SwipeYears {
  const covered = YEAR_KEYS.filter((k) => coversPoint(k, camera));
  return covered.length > 1 ? [covered[0], covered[covered.length - 1]] : [...DEFAULT_SWIPE];
}

export function readOgScene(search: string): OgScene {
  const state = readMapState(search);
  const camera = readCamera(search) ?? START;
  return {
    camera,
    years: state.mode === 'compare' ? state.swipe : state.mode === 'year' ? [state.year] : timelapseEnds(camera),
    isHorizontal: state.mode === 'compare' && state.isHorizontal,
    query: mapStateToQuery(state, camera),
  };
}

export function ogImagePath(scene: OgScene, locale: Locale) {
  return `/og${scene.query}${locale === DEFAULT_LOCALE ? '' : `&lang=${locale}`}`;
}
