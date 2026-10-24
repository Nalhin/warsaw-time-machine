import Link from 'next/link';

import { isLocale, localePath } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { spotsFor } from '@/lib/spot-data';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return null;
  const t = MESSAGES[lang];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}${localePath(lang, '/')}`,
    description: t.site.description,
    inLanguage: lang,
    about: { '@type': 'City', name: 'Warsaw', alternateName: 'Warszawa' },
  };

  return (
    <section className="sr-only">
      <h1>{t.site.heading}</h1>
      <p>{t.site.description}</p>
      <nav aria-label={t.site.places}>
        <h2>{t.site.places}</h2>
        <ul>
          {spotsFor(lang).map((s) => (
            <li key={s.id}>
              <Link href={localePath(lang, `/spots/${s.id}`)}>{s.name}</Link>
              {s.description && <p>{s.description}</p>}
            </li>
          ))}
        </ul>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
