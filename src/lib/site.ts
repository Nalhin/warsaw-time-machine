export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Warsaw 1935 / 1945 / Today';

export const SITE_DESCRIPTION =
  'Compare aerial photos of Warsaw from 1935, 1945 and today, and see pre-war street photographs next to the same view today.';

export const WARSAW_BBOX = { south: 52.07, west: 20.82, north: 52.39, east: 21.29 };
