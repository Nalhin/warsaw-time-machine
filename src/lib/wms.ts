import L from 'leaflet';

import { fadeWhite, FALLBACK_URL, getMapUrl, LABEL_LAYERS, PRIMARY_URL, type BBox } from './wms-request';
import { yearDef, type YearKey } from './years';

export type { BBox };

const FAILS_BEFORE_FALLBACK = 3;

let isPrimaryDead = false;

export function whiteToAlpha(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  fadeWhite(data.data);
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

export interface LayerCredit {
  label: string;
  owner: string;
}

export function createYearLayer(key: YearKey, pane: string, credit: LayerCredit): L.TileLayer.WMS {
  const def = yearDef(key);
  const Layer = def.whiteIsBlank ? BlankWhiteWMS : L.TileLayer.WMS;
  const shouldUseFallback = isPrimaryDead && !!def.fallbackLayer;
  const layer = new Layer(shouldUseFallback ? FALLBACK_URL : PRIMARY_URL, {
    layers: shouldUseFallback ? def.fallbackLayer : def.layer,
    format: 'image/png',
    transparent: true,
    bounds: L.latLngBounds(def.coverage),
    version: '1.1.1',
    tileSize: 512,
    pane,
    maxZoom: 21,
    keepBuffer: 1,
    updateWhenZooming: false,
    attribution: `${credit.label} <a href="https://mapa.um.warszawa.pl" target="_blank" rel="noopener">${credit.owner}</a>`,
    ...(shouldUseFallback ? {} : { DATASOURCE: 'dane_wawa' }),
  } as L.WMSOptions);

  let loadedCount = 0;
  let failedCount = 0;
  layer.on('tileload', () => loadedCount++);
  layer.on('tileerror', () => {
    failedCount++;
    if (!def.fallbackLayer || (layer as any)._url === FALLBACK_URL) return;
    if (loadedCount === 0 && failedCount >= FAILS_BEFORE_FALLBACK) {
      isPrimaryDead = true;
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
  if (!isPrimaryDead || !def.fallbackLayer) {
    try {
      return await loadImage(getMapUrl(PRIMARY_URL, def.layer, bbox, width, height));
    } catch {
      if (!def.fallbackLayer) throw new Error(`[wms] ${def.layer}: GetMap failed`);
      console.warn(`[wms] ${def.layer}: GetMap failed, trying ${FALLBACK_URL}`);
    }
  }
  return loadImage(getMapUrl(FALLBACK_URL, def.fallbackLayer, bbox, width, height));
}

export function fetchLabelImage(bbox: BBox, width: number, height: number) {
  return loadImage(getMapUrl(PRIMARY_URL, LABEL_LAYERS, bbox, width, height));
}
