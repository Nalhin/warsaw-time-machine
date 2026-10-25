import Link from 'next/link';

import { isLocale, localePath } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { spotsFor } from '@/lib/spot-data';
import { AUTHOR_ID, AUTHOR_NODE, jsonLdScript, WARSAW, websiteNode } from '@/lib/structured-data';
import { YEAR_KEYS } from '@/lib/years';

interface HomeProps {
  params: Promise<{ lang: string }>;
}

export default async function Home({ params }: HomeProps) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = MESSAGES[lang];
  const spots = spotsFor(lang);
  const url = `${SITE_URL}${localePath(lang, '/')}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      websiteNode(lang),
      AUTHOR_NODE,
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url,
        description: t.site.description,
        inLanguage: lang,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        image: `${SITE_URL}/img/og/default.jpg`,
        author: { '@id': AUTHOR_ID },
        about: WARSAW,
        temporalCoverage: `1935/${new Date().getFullYear()}`,
        spatialCoverage: WARSAW,
      },
      {
        '@type': 'ItemList',
        name: t.site.places,
        numberOfItems: spots.length,
        itemListElement: spots.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          url: `${SITE_URL}${localePath(lang, `/spots/${s.id}`)}`,
        })),
      },
    ],
  };

  return (
    <section className="sr-only">
      <h1>{t.site.heading}</h1>
      <p>{t.site.description}</p>
      <p>
        <Link href={localePath(lang, '/about')}>{t.about.title}</Link>
      </p>
      <h2>{t.site.aerialYears}</h2>
      <ul>
        {YEAR_KEYS.map((k) => (
          <li key={k}>
            {t.years[k].long}
            {t.years[k].era && ` (${t.years[k].era})`}
          </li>
        ))}
      </ul>
      <nav aria-label={t.site.places}>
        <h2>{t.site.places}</h2>
        <ul>
          {spots.map((s) => (
            <li key={s.id}>
              <Link href={localePath(lang, `/spots/${s.id}`)}>{s.name}</Link>
              {s.description && <p>{s.description}</p>}
            </li>
          ))}
        </ul>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
    </section>
  );
}
