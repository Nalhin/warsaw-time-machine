import coverage from '@/data/coverage.json';

export const YEAR_KEYS = [
  '1935',
  '1944',
  '1945',
  '1951',
  '1972',
  '1976',
  '1982',
  '1987',
  '1990',
  '1997',
  '2001',
  '2005',
  '2008',
  '2010',
  '2011',
  '2012',
  '2013',
  '2014',
  '2015',
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  'today',
] as const;
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
  layer: string;
  fallbackLayer?: string;
  outline: Ring[];
  coverage: Box;
  whiteIsBlank?: boolean;
  label?: string;
}

function year(key: YearKey, def: Omit<YearDef, 'key' | 'outline' | 'coverage'>): YearDef {
  return { key, ...def, outline: OUTLINES[key], coverage: boundsOf(OUTLINES[key]) };
}

export const YEARS: YearDef[] = [
  year('1935', { layer: 'FOTOPLAN_1935', fallbackLayer: 'RASTER_FOTOPLAN_1935' }),
  year('1944', { layer: 'MUZEUM_PW_ORTO_1944' }),
  year('1945', { layer: 'ORTOFOTO_1945', fallbackLayer: 'RASTER_ORTOFOTO_1945', whiteIsBlank: true }),
  year('1951', { layer: 'ZDJECIA_1951' }),
  year('1972', { layer: 'ZDJECIA_1972' }),
  year('1976', { layer: 'FOTOSZKIC_1976', label: '1976–77' }),
  year('1982', { layer: 'FOTOSZKIC_1982' }),
  year('1987', { layer: 'FOTOSZKIC_1987' }),
  year('1990', { layer: 'FOTOSZKIC_1990_1994', label: '1990–94' }),
  year('1997', { layer: 'ZDJECIA_1997' }),
  year('2001', { layer: 'ORTOFOTO_2001' }),
  year('2005', { layer: 'ORTOFOTO_2005', fallbackLayer: 'RASTER_ORTOFOTO_2005' }),
  year('2008', { layer: 'ORTOFOTO_2008', fallbackLayer: 'RASTER_ORTOFOTO_2008' }),
  year('2010', { layer: 'ORTOFOTO_2010', fallbackLayer: 'RASTER_ORTOFOTO_2010' }),
  year('2011', { layer: 'FOTOPLAN_2011', fallbackLayer: 'RASTER_FOTOPLAN_2011' }),
  year('2012', { layer: 'FOTOPLAN_2012', fallbackLayer: 'RASTER_FOTOPLAN_2012' }),
  year('2013', { layer: 'ORTOFOTO_2013', fallbackLayer: 'RASTER_ORTOFOTO_2013' }),
  ...(['2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021'] as const).map((k) =>
    year(k, { layer: `FOTOPLAN_${k}`, fallbackLayer: `RASTER_FOTOPLAN_${k}` }),
  ),
  year('2022', { layer: 'ORTOFOTO_2022' }),
  year('2023', { layer: 'ORTOFOTO_2023' }),
  year('2024', { layer: 'ORTOFOTO_2024' }),
  year('today', { layer: 'ORTOFOTO_2025', fallbackLayer: 'ORTO' }),
];

export function yearDef(key: YearKey) {
  return YEARS.find((y) => y.key === key)!;
}

export function yearLabel(key: YearKey) {
  return yearDef(key).label ?? key;
}

export function stepYear(key: YearKey, delta: number): YearKey | undefined {
  return YEAR_KEYS[YEAR_KEYS.indexOf(key) + delta];
}

export function otherYear(key: YearKey | null): YearKey {
  return key === 'today' ? '1935' : 'today';
}

export function featherPx(zoom: number) {
  return Math.min(24, Math.max(3, 3 * 2 ** ((zoom - 11) / 2)));
}

export function parseYear(v: string | null | undefined): YearKey | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === 'today' || s === 'dzis' || s === 'dziś' || s === '2025' || s === 'now') return 'today';
  return (YEAR_KEYS as readonly string[]).includes(s) ? (s as YearKey) : null;
}
