import Link from 'next/link';

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { SPOTS } from '@/lib/spots';

export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    about: { '@type': 'City', name: 'Warsaw', alternateName: 'Warszawa' },
  };

  return (
    <section className="sr-only">
      <h1>Warsaw in 1935, 1945 and today: historical aerial photos and pre-war street views</h1>
      <p>{SITE_DESCRIPTION}</p>
      <nav aria-label="Places">
        <h2>Places</h2>
        <ul>
          {SPOTS.map((s) => (
            <li key={s.id}>
              <Link href={`/spots/${s.id}`}>{s.name}</Link>
              {s.description && <p>{s.description}</p>}
            </li>
          ))}
        </ul>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
