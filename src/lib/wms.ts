import L from 'leaflet';

import { yearDef, type YearKey } from './years';

const PRIMARY_URL = 'https://mapa.um.warszawa.pl/mapviewer/wms';
const FALLBACK_URL = 'https://wms.um.warszawa.pl/serwis';
const FAILS_BEFORE_FALLBACK = 3;

let primaryDead = false;

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
