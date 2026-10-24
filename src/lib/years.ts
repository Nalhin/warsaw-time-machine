import coverage from '@/data/coverage.json';

export const YEAR_KEYS = ['1935', '1945', '1951', '1972', '1987', '2001', '2010', 'today'] as const;
export type YearKey = (typeof YEAR_KEYS)[number];

export type Ring = [number, number][];
export type Box = [[number, number], [number, number]];

const OUTLINES = coverage as Record<YearKey, Ring[]>;

function boundsOf(rings: Ring[]): Box {
  const pts = rings.flat();
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

export interface YearDef {
  key: YearKey;
  label: string;
  long: string;
  era?: string;
  layer: string;
  fallbackLayer?: string;
  outline: Ring[];
  coverage: Box;
  whiteIsBlank?: boolean;
}

const year = (key: YearKey, def: Omit<YearDef, 'key' | 'outline' | 'coverage'>): YearDef => ({
  key,
  ...def,
  outline: OUTLINES[key],
  coverage: boundsOf(OUTLINES[key]),
});

export const YEARS: YearDef[] = [
  year('1935', { label: '1935', long: 'Aerial photomap, 1935', era: 'Before the war', layer: 'FOTOPLAN_1935', fallbackLayer: 'RASTER_FOTOPLAN_1935' }),
  year('1945', { label: '1945', long: 'Aerial photo, 1945 (after the destruction)', era: 'After the destruction', layer: 'ORTOFOTO_1945', fallbackLayer: 'RASTER_ORTOFOTO_1945', whiteIsBlank: true }),
  year('1951', { label: '1951', long: 'Aerial photos, 1951 (rebuilding)', era: 'Rebuilding', layer: 'ZDJECIA_1951' }),
  year('1972', { label: '1972', long: 'Aerial photos, 1972', era: "People's Republic", layer: 'ZDJECIA_1972' }),
  year('1987', { label: '1987', long: 'Aerial photo sketch, 1987', era: 'Late 1980s', layer: 'FOTOSZKIC_1987' }),
  year('2001', { label: '2001', long: 'Aerial photo, 2001', era: 'After the transition', layer: 'ORTOFOTO_2001' }),
  year('2010', { label: '2010', long: 'Aerial photo, 2010', layer: 'ORTOFOTO_2010', fallbackLayer: 'RASTER_ORTOFOTO_2010' }),
  year('today', { label: 'Today', long: 'Aerial photo, 2025', era: '2025', layer: 'ORTOFOTO_2025', fallbackLayer: 'ORTO' }),
];

export const yearDef = (key: YearKey) => YEARS.find((y) => y.key === key)!;

export const featherPx = (zoom: number) => Math.min(24, Math.max(3, 3 * 2 ** ((zoom - 11) / 2)));

export function parseYear(v: string | null | undefined): YearKey | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === 'today' || s === 'dzis' || s === 'dziś' || s === '2025' || s === 'now') return 'today';
  return (YEAR_KEYS as readonly string[]).includes(s) ? (s as YearKey) : null;
}
