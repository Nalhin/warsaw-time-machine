import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlacePanel } from '@/components/place-panel';
import { isLocale, languageAlternates, LOCALES, localePath, OG_LOCALE, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { getSpot, SPOT_IDS } from '@/lib/spot-data';
import type { Credit, Spot } from '@/lib/spots';

interface SpotPageProps {
  params: Promise<{ lang: string; id: string }>;
}

export function generateStaticParams() {
  return SPOT_IDS.map((id) => ({ id }));
}

async function resolve(params: SpotPageProps['params']) {
  const { lang, id } = await params;
  if (!isLocale(lang)) return null;
  const spot = getSpot(id, lang);
  return spot ? { locale: lang, spot } : null;
}

function describe(s: Spot, locale: Locale) {
  return (
    s.description?.split(/(?<=\.)\s/)[0] ??
    MESSAGES[locale].spot.fallbackDescription(s.name, s.photos.length, s.photos[0].date, s.photos[s.photos.length - 1].date)
  );
}

export async function generateMetadata({ params }: SpotPageProps): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { locale, spot } = found;
  const t = MESSAGES[locale];
  const title = t.spot.title(spot.name);
  const description = describe(spot, locale);
  const image = spot.og ?? '/img/og/default.jpg';
  const path = `/spots/${spot.id}`;
  return {
    title,
    description,
    alternates: { canonical: localePath(locale, path), languages: languageAlternates(path) },
    openGraph: {
      type: 'article',
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      title,
      description,
      url: localePath(locale, path),
      images: [{ url: image, width: 1200, height: 630, alt: t.spot.ogAlt(spot.name) }],
    },
    twitter: { card: 'summary_large_image', creator: '@KrzysztofOlipra', title, description, images: [image] },
  };
}

function imageObject(url: string, name: string, credit: string | Credit) {
  return {
    '@type': 'ImageObject',
    contentUrl: `${SITE_URL}${url}`,
    name,
    ...(typeof credit === 'string'
      ? { creditText: credit }
      : {
          creator: { '@type': 'Person', name: credit.author },
          creditText: credit.author,
          ...(credit.date && { dateCreated: credit.date }),
          ...(credit.licenceUrl && { license: credit.licenceUrl }),
          ...(credit.sourceUrl && { acquireLicensePage: credit.sourceUrl }),
        }),
  };
}

export default async function SpotPage({ params }: SpotPageProps) {
  const found = await resolve(params);
  if (!found) notFound();
  const { locale, spot } = found;
  const url = `${SITE_URL}${localePath(locale, `/spots/${spot.id}`)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        name: spot.name,
        description: spot.description,
        url,
        geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
        containedInPlace: { '@type': 'City', name: 'Warsaw', alternateName: 'Warszawa' },
        image: spot.photos.map((p) => imageObject(p.src, `${spot.name}, ${p.date}`, p.credit)),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}${localePath(locale, '/')}` },
          { '@type': 'ListItem', position: 2, name: spot.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <PlacePanel spot={spot} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
