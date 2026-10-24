import L from 'leaflet';

export type YearKey = '1935' | '1945' | 'today';

export interface YearDef {
  key: YearKey;
  label: string;
  long: string;
  /** Primary source: mapa.um.warszawa.pl (needs DATASOURCE=dane_wawa). */
  layer: string;
  /** Fallback source: the official wms.um.warszawa.pl/serwis endpoint. */
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

const PRIMARY_URL = 'https://mapa.um.warszawa.pl/mapviewer/wms';
const FALLBACK_URL = 'https://wms.um.warszawa.pl/serwis';
/** Switch to the fallback endpoint after this many failed tiles with no successful one. */
const FAILS_BEFORE_FALLBACK = 3;

// Remember a dead primary across layers so we don't pay the timeout again on every year switch.
let primaryDead = false;

/**
 * WMS layer for one year. Tiles are 512 px (fewer requests to a slow server).
 * If the primary endpoint keeps failing, it switches to the official fallback endpoint.
 */
export function createYearLayer(key: YearKey, pane: string): L.TileLayer.WMS {
  const def = yearDef(key);
  const layer = L.tileLayer.wms(primaryDead ? FALLBACK_URL : PRIMARY_URL, {
    layers: primaryDead ? def.fallbackLayer : def.layer,
    format: 'image/png',
    transparent: false,
    version: '1.1.1',
    tileSize: 512,
    pane,
    maxZoom: 21,
    keepBuffer: 1,
    updateWhenZooming: false,
    attribution: 'Aerial photos: <a href="https://mapa.um.warszawa.pl" target="_blank" rel="noopener">City of Warsaw</a>',
    // Unknown options are passed through to the WMS query string.
    ...(primaryDead ? {} : { DATASOURCE: 'dane_wawa' }),
  } as L.WMSOptions);

  let ok = 0;
  let failed = 0;
  layer.on('tileload', () => ok++);
  layer.on('tileerror', () => {
    failed++;
    if (primaryDead && (layer as any)._url === FALLBACK_URL) return;
    if (ok === 0 && failed >= FAILS_BEFORE_FALLBACK) {
      primaryDead = true;
      const params = (layer as any).wmsParams as Record<string, unknown>;
      delete params.DATASOURCE;
      params.layers = def.fallbackLayer;
      layer.setUrl(FALLBACK_URL);
      console.warn(`[wms] ${def.layer}: switching to ${FALLBACK_URL}`);
    }
  });
  return layer;
}
