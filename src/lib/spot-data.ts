import data from '@/data/spots.json';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import type { Spot } from '@/lib/spots';

const RAW = data as Spot[];

function localize({ pl, ...spot }: Spot, locale: Locale): Spot {
  if (locale === DEFAULT_LOCALE) return { ...spot, photos: spot.photos.map(({ pl, ...p }) => p) };
  const t = MESSAGES[locale];
  return {
    ...spot,
    name: pl?.name ?? spot.name,
    description: pl?.description ?? spot.description,
    photos: spot.photos.map(({ pl, ...p }) => ({
      ...p,
      date: t.date(p.date),
      caption: pl?.caption ?? p.caption,
      credit: {
        ...p.credit,
        author: t.author(p.credit.author),
        date: p.credit.date && t.date(p.credit.date),
        licence: t.licence(p.credit.licence),
      },
    })),
  };
}

const BY_LOCALE = new Map<Locale, Spot[]>();

export function spotsFor(locale: Locale): Spot[] {
  let spots = BY_LOCALE.get(locale);
  if (!spots) BY_LOCALE.set(locale, (spots = RAW.map((s) => localize(s, locale))));
  return spots;
}

export const SPOT_IDS = RAW.map((s) => s.id);

export const getSpot = (id: string, locale: Locale) => spotsFor(locale).find((s) => s.id === id);
