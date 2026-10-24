import type { YearKey } from '@/lib/years';

export interface Credit {
  author: string;
  date?: string;
  licence: string;
  licenceUrl?: string;
  source?: string;
  sourceUrl?: string;
}

export interface Photo {
  src: string;
  pin: string;
  year: number;
  date: string;
  approx?: boolean;
  ratio: number;
  caption?: string;
  pl?: { caption?: string };
  credit: Credit;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind?: 'historic' | 'modern';
  description?: string;
  pl?: { name?: string; description?: string };
  og?: string;
  photos: Photo[];
}

export function spotIdFromPath(pathname: string | null) {
  return /^(?:\/(?:en|pl))?\/spots\/([^/]+)/.exec(pathname ?? '')?.[1] ?? null;
}

export const NEAR_YEARS = 12;

export function yearNumber(key: YearKey) {
  return key === 'today' ? new Date().getFullYear() : Number(key);
}

export function nearestPhoto(spot: Spot, year: number): Photo {
  return spot.photos.reduce((best, p) => (Math.abs(p.year - year) < Math.abs(best.year - year) ? p : best));
}

export function hasPhotoNear(spot: Spot, year: number) {
  return spot.photos.some((p) => Math.abs(p.year - year) <= NEAR_YEARS);
}
