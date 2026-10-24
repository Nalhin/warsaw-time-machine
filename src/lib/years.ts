export type YearKey = '1935' | '1945' | 'today';

export interface YearDef {
  key: YearKey;
  label: string;
  long: string;
  layer: string;
  fallbackLayer: string;
}

export const YEARS: YearDef[] = [
  { key: '1935', label: '1935', long: 'Aerial photomap, 1935', layer: 'FOTOPLAN_1935', fallbackLayer: 'RASTER_FOTOPLAN_1935' },
  { key: '1945', label: '1945', long: 'Aerial photo, 1945 (after the destruction)', layer: 'ORTOFOTO_1945', fallbackLayer: 'RASTER_ORTOFOTO_1945' },
  { key: 'today', label: 'Today', long: 'Aerial photo, 2025', layer: 'ORTOFOTO_2025', fallbackLayer: 'ORTO' },
];

export const yearDef = (key: YearKey) => YEARS.find((y) => y.key === key)!;

export function parseYear(v: string | null | undefined): YearKey | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === '1935' || s === '1945') return s;
  if (s === 'today' || s === 'dzis' || s === 'dziś' || s === '2025' || s === 'now') return 'today';
  return null;
}
