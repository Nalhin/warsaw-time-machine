import data from '@/data/spots.json';

export interface Credit {
  author: string;
  date?: string;
  licence: string;
  licenceUrl?: string;
  source?: string;
  sourceUrl?: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heading?: string;
  description?: string;
  oldYear?: string;
  old: string;
  restored?: string;
  today: string;
  og?: string;
  compare?: { old: string; today: string; restored?: string };
  credits: { old: string | Credit; today: string | Credit };
}

export const SPOTS = data as Spot[];

export const getSpot = (id: string) => SPOTS.find((s) => s.id === id);

export const spotIdFromPath = (pathname: string | null) => /^\/spots\/([^/]+)/.exec(pathname ?? '')?.[1] ?? null;
