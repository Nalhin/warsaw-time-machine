import L from 'leaflet';

import { yearDef, type YearKey } from './years';

const PRIMARY_URL = 'https://mapa.um.warszawa.pl/mapviewer/wms';
const FALLBACK_URL = 'https://wms.um.warszawa.pl/serwis';
const FAILS_BEFORE_FALLBACK = 3;
const LABEL_LAYERS = [
  'ORTO_ULICE_GLOWNE_3',
  'ORTO_ULICE_GLOWNE_4',
  'ORTO_ULICE_LINIOWE_5_18',
  'ORTO_ULICE_POWIERZCHNIOWE_9_14',
  'ORTO_ULICE_POWIERZCHNIOWE_15_18',
].join(',');

let primaryDead = false;

export function whiteToAlpha(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const min = Math.min(px[i], px[i + 1], px[i + 2]);
    if (min >= 240) px[i + 3] = Math.min(px[i + 3], (Math.max(0, 252 - min) / 12) * 255);
  }
  ctx.putImageData(data, 0, 0);
}

const BlankWhiteWMS: new (url: string, options: L.WMSOptions) => L.TileLayer.WMS = L.TileLayer.WMS.extend({
  createTile(this: L.TileLayer.WMS, coords: L.Coords, done: L.DoneCallback) {
    const size = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width = size.x;
    canvas.height = size.y;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      whiteToAlpha(canvas, img);
      done(undefined, canvas);
    };
    img.onerror = () => done(new Error(`Tile failed: ${img.src}`), canvas);
    img.src = this.getTileUrl(coords);
    return canvas;
  },
});

export function createYearLayer(key: YearKey, pane: string): L.TileLayer.WMS {
  const def = yearDef(key);
  const Layer = def.whiteIsBlank ? BlankWhiteWMS : L.TileLayer.WMS;
  const layer = new Layer(primaryDead ? FALLBACK_URL : PRIMARY_URL, {
    layers: primaryDead ? def.fallbackLayer : def.layer,
    format: 'image/png',
    transparent: true,
    bounds: L.latLngBounds(def.coverage),
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

export function createLabelLayer(pane: string): L.TileLayer.WMS {
  return L.tileLayer.wms(PRIMARY_URL, {
    layers: LABEL_LAYERS,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    tileSize: 512,
    pane,
    maxZoom: 21,
    keepBuffer: 1,
    updateWhenZooming: false,
    DATASOURCE: 'dane_wawa',
  } as L.WMSOptions);
}

export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

function getMapUrl(base: string, layers: string, bbox: BBox, width: number, height: number) {
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed: ${src}`));
    img.src = src;
  });
}

export async function fetchYearImage(key: YearKey, bbox: BBox, width: number, height: number) {
  const def = yearDef(key);
  if (!primaryDead) {
    try {
      return await loadImage(getMapUrl(PRIMARY_URL, def.layer, bbox, width, height));
    } catch {
      console.warn(`[wms] ${def.layer}: GetMap failed, trying ${FALLBACK_URL}`);
    }
  }
  return loadImage(getMapUrl(FALLBACK_URL, def.fallbackLayer, bbox, width, height));
}

export function fetchLabelImage(bbox: BBox, width: number, height: number) {
  return loadImage(getMapUrl(PRIMARY_URL, LABEL_LAYERS, bbox, width, height));
}
