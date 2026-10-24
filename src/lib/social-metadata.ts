import type { Metadata } from 'next';

import { LOCALES, OG_LOCALE, type Locale } from './i18n';
import { SITE_NAME } from './site';

interface SocialCard {
  type: 'website' | 'article';
  title: string;
  description: string;
  url: string;
  image: string;
  alt: string;
}

export function socialMetadata(locale: Locale, { type, title, description, url, image, alt }: SocialCard): Metadata {
  return {
    openGraph: {
      type,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: { card: 'summary_large_image', creator: '@KrzysztofOlipra', title, description, images: [image] },
  };
}
