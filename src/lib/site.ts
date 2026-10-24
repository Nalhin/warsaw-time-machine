export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Warsaw Timelapse';

export const WARSAW_BBOX = { south: 52.07, west: 20.82, north: 52.39, east: 21.29 };

export function isInWarsaw(lat: number, lng: number) {
  const b = WARSAW_BBOX;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

export const GITHUB_URL = 'https://github.com/Nalhin/warsaw-timelapse';

export const AUTHOR = {
  name: 'Krzysztof Olipra',
  x: 'https://x.com/KrzysztofOlipra',
  website: 'https://krzysztofolipra.com/',
};
