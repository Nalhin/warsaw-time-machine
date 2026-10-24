import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SpotPanel } from '@/components/SpotPanel';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { getSpot, SPOTS, type Credit, type Spot } from '@/lib/spots';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SPOTS.map((s) => ({ id: s.id }));
}

const describe = (s: Spot) =>
  s.description?.split(/(?<=\.)\s/)[0] ??
  `${s.name} in Warsaw: a pre-war photograph, an AI-restored version, and the same view today.`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const spot = getSpot((await params).id);
  if (!spot) return {};
  const title = `${spot.name}: Warsaw before the war and today`;
  const description = describe(spot);
  const image = spot.og ?? '/img/og/default.jpg';
  return {
    title,
    description,
    alternates: { canonical: `/spots/${spot.id}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/spots/${spot.id}`,
      images: [{ url: image, width: 1200, height: 630, alt: `${spot.name}: before the war and today` }],
    },
    twitter: { card: 'summary_large_image', creator: '@KrzysztofOlipra', title, description, images: [image] },
  };
}

const imageObject = (url: string, name: string, credit: string | Credit) => ({
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
});

export default async function SpotPage({ params }: Props) {
  const spot = getSpot((await params).id);
  if (!spot) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        name: spot.name,
        description: spot.description,
        url: `${SITE_URL}/spots/${spot.id}`,
        geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
        containedInPlace: { '@type': 'City', name: 'Warsaw', alternateName: 'Warszawa' },
        image: [
          imageObject(spot.old, `${spot.name}${spot.oldYear ? `, ${spot.oldYear}` : ', before 1939'}`, spot.credits.old),
          imageObject(spot.today, `${spot.name} today`, spot.credits.today),
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: spot.name, item: `${SITE_URL}/spots/${spot.id}` },
        ],
      },
    ],
  };

  return (
    <>
      <SpotPanel spot={spot} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
