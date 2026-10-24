import data from '@/data/spots.json';
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
  credit: Credit;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind?: 'historic' | 'modern';
  description?: string;
  og?: string;
  photos: Photo[];
}

export const SPOTS = data as Spot[];

export const getSpot = (id: string) => SPOTS.find((s) => s.id === id);

export const spotIdFromPath = (pathname: string | null) => /^\/spots\/([^/]+)/.exec(pathname ?? '')?.[1] ?? null;

export const NEAR_YEARS = 12;

export const yearNumber = (key: YearKey) => (key === 'today' ? new Date().getFullYear() : Number(key));

export function nearestPhoto(spot: Spot, year: number): Photo {
  return spot.photos.reduce((best, p) => (Math.abs(p.year - year) < Math.abs(best.year - year) ? p : best));
}

export const hasPhotoNear = (spot: Spot, year: number) => spot.photos.some((p) => Math.abs(p.year - year) <= NEAR_YEARS);
