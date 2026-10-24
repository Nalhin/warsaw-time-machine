export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Warsaw Time Machine';

export const SITE_DESCRIPTION =
  'Compare aerial photos of Warsaw from 1935, 1945 after the destruction, the rebuilding years and today, and see street photos of the same places from the 1920s to today.';

export const WARSAW_BBOX = { south: 52.07, west: 20.82, north: 52.39, east: 21.29 };

export const GITHUB_URL = 'https://github.com/Nalhin/warsaw-time-machine';

export const AUTHOR = {
  name: 'Krzysztof Olipra',
  x: 'https://x.com/KrzysztofOlipra',
  website: 'https://krzysztofolipra.com/',
};
