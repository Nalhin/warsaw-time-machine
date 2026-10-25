import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlacePanel } from '@/components/place-panel';
import { isLocale, languageAlternates, localePath, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { socialMetadata } from '@/lib/social-metadata';
import { getSpot, nearbySpots, SPOT_IDS } from '@/lib/spot-data';
import type { Photo, Spot } from '@/lib/spots';
import { jsonLdScript, WARSAW, WEBSITE_ID } from '@/lib/structured-data';

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

const DESCRIPTION_LIMIT = 160;

function describe(s: Spot, locale: Locale) {
  if (!s.description)
    return MESSAGES[locale].spot.fallbackDescription(s.name, s.photos.length, s.photos[0].date, s.photos[s.photos.length - 1].date);
  const [first, ...rest] = s.description.split(/(?<=\.)\s/);
  return rest.reduce((text, sentence) => (text.length + sentence.length < DESCRIPTION_LIMIT ? `${text} ${sentence}` : text), first);
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
    ...socialMetadata(locale, {
      type: 'article',
      title,
      description,
      url: localePath(locale, path),
      image,
      alt: t.spot.ogAlt(spot.name),
    }),
  };
}

function imageObject(spot: Spot, { src, date, caption, credit }: Photo) {
  return {
    '@type': 'ImageObject',
    contentUrl: `${SITE_URL}${src}`,
    name: `${spot.name}, ${date}`,
    ...(caption && { caption }),
    contentLocation: { '@id': placeId(spot) },
    creator: { '@type': 'Person', name: credit.author },
    creditText: credit.author,
    ...(credit.date && { dateCreated: credit.date }),
    ...(credit.licenceUrl && { license: credit.licenceUrl }),
    ...(credit.sourceUrl && { acquireLicensePage: credit.sourceUrl }),
  };
}

function placeId(spot: Spot) {
  return `${SITE_URL}/spots/${spot.id}#place`;
}

export default async function SpotPage({ params }: SpotPageProps) {
  const found = await resolve(params);
  if (!found) notFound();
  const { locale, spot } = found;
  const t = MESSAGES[locale];
  const url = `${SITE_URL}${localePath(locale, `/spots/${spot.id}`)}`;
  const nearby = nearbySpots(spot, locale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemPage',
        '@id': url,
        url,
        name: t.spot.title(spot.name),
        description: describe(spot, locale),
        inLanguage: locale,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': placeId(spot) },
        mainEntity: { '@id': placeId(spot) },
        primaryImageOfPage: `${SITE_URL}${spot.og ?? '/img/og/default.jpg'}`,
        breadcrumb: { '@id': `${url}#breadcrumb` },
        relatedLink: nearby.map((s) => `${SITE_URL}${localePath(locale, `/spots/${s.id}`)}`),
      },
      {
        '@type': spot.kind === 'modern' ? 'TouristAttraction' : 'LandmarksOrHistoricalBuildings',
        '@id': placeId(spot),
        name: spot.name,
        description: spot.description,
        url,
        geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
        hasMap: `${SITE_URL}${localePath(locale, '/')}?at=${spot.lat},${spot.lng},17`,
        containedInPlace: WARSAW,
        image: spot.photos.map((p) => imageObject(spot, p)),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}${localePath(locale, '/')}` },
          { '@type': 'ListItem', position: 2, name: spot.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <PlacePanel spot={spot} nearby={nearby} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
    </>
  );
}
