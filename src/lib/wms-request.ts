export const PRIMARY_URL = 'https://mapa.um.warszawa.pl/mapviewer/wms';
export const FALLBACK_URL = 'https://wms.um.warszawa.pl/serwis';
export const LABEL_LAYERS = [
  'ORTO_ULICE_GLOWNE_3',
  'ORTO_ULICE_GLOWNE_4',
  'ORTO_ULICE_LINIOWE_5_18',
  'ORTO_ULICE_POWIERZCHNIOWE_9_14',
  'ORTO_ULICE_POWIERZCHNIOWE_15_18',
].join(',');

const EARTH_RADIUS = 6378137;

export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

export function project(lat: number, lng: number): [number, number] {
  return [
    (EARTH_RADIUS * lng * Math.PI) / 180,
    EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  ];
}

export function metersPerPixel(zoom: number) {
  return (2 * Math.PI * EARTH_RADIUS) / (256 * 2 ** zoom);
}

export function fadeWhite(px: Uint8Array | Uint8ClampedArray) {
  for (let i = 0; i < px.length; i += 4) {
    const min = Math.min(px[i], px[i + 1], px[i + 2]);
    if (min >= 240) px[i + 3] = Math.min(px[i + 3], (Math.max(0, 252 - min) / 12) * 255);
  }
}

export function getMapUrl(base: string, layers: string, bbox: BBox, width: number, height: number) {
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: layers,
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
    SRS: 'EPSG:3857',
    BBOX: bbox.map((v) => v.toFixed(2)).join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
  });
  if (base === PRIMARY_URL) q.set('DATASOURCE', 'dane_wawa');
  return `${base}?${q}`;
}
