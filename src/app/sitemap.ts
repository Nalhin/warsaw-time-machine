import type { MetadataRoute } from 'next';

import { languageAlternates, LOCALES, localePath } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { spotsFor } from '@/lib/spot-data';

function absolute(languages: Record<string, string>) {
  return Object.fromEntries(Object.entries(languages).map(([l, p]) => [l, `${SITE_URL}${p}`]));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) => [
    {
      url: `${SITE_URL}${localePath(locale, '/')}`,
      changeFrequency: 'monthly' as const,
      priority: 1,
      alternates: { languages: absolute(languageAlternates('/')) },
    },
    {
      url: `${SITE_URL}${localePath(locale, '/about')}`,
      changeFrequency: 'yearly' as const,
      priority: 0.6,
      alternates: { languages: absolute(languageAlternates('/about')) },
    },
    ...spotsFor(locale).map((s) => ({
      url: `${SITE_URL}${localePath(locale, `/spots/${s.id}`)}`,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
      alternates: { languages: absolute(languageAlternates(`/spots/${s.id}`)) },
      images: s.photos.map((p) => `${SITE_URL}${p.src}`),
    })),
  ]);
}
