import coverage from '@/data/coverage.json';

export type YearKey = '1935' | '1945' | 'today';

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
  layer: string;
  fallbackLayer: string;
  outline: Ring[];
  coverage: Box;
  whiteIsBlank?: boolean;
}

export const YEARS: YearDef[] = [
  { key: '1935', label: '1935', long: 'Aerial photomap, 1935', layer: 'FOTOPLAN_1935', fallbackLayer: 'RASTER_FOTOPLAN_1935', outline: OUTLINES['1935'], coverage: boundsOf(OUTLINES['1935']) },
  { key: '1945', label: '1945', long: 'Aerial photo, 1945 (after the destruction)', layer: 'ORTOFOTO_1945', fallbackLayer: 'RASTER_ORTOFOTO_1945', outline: OUTLINES['1945'], coverage: boundsOf(OUTLINES['1945']), whiteIsBlank: true },
  { key: 'today', label: 'Today', long: 'Aerial photo, 2025', layer: 'ORTOFOTO_2025', fallbackLayer: 'ORTO', outline: OUTLINES['today'], coverage: boundsOf(OUTLINES['today']) },
];

export const yearDef = (key: YearKey) => YEARS.find((y) => y.key === key)!;

export const featherPx = (zoom: number) => Math.min(24, Math.max(3, 3 * 2 ** ((zoom - 11) / 2)));

export function parseYear(v: string | null | undefined): YearKey | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === '1935' || s === '1945') return s;
  if (s === 'today' || s === 'dzis' || s === 'dziś' || s === '2025' || s === 'now') return 'today';
  return null;
}
