import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/AppShell';
import { isLocale, languageAlternates, LOCALES, localePath, OG_LOCALE } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { AUTHOR, SITE_NAME, SITE_URL } from '@/lib/site';
import { YEAR_KEYS } from '@/lib/years';

export { viewport } from '@/components/AppShell';

type Props = { params: Promise<{ lang: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = MESSAGES[lang];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: t.site.description,
    applicationName: SITE_NAME,
    authors: [{ name: AUTHOR.name, url: AUTHOR.website }],
    creator: AUTHOR.name,
    keywords: [...t.site.keywords, ...YEAR_KEYS.filter((k) => k !== 'today'), SITE_NAME],
    alternates: { canonical: localePath(lang, '/'), languages: languageAlternates('/') },
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[lang],
      alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: t.site.description,
      url: localePath(lang, '/'),
      images: [{ url: '/img/og/default.jpg', width: 1200, height: 630, alt: t.site.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      creator: '@KrzysztofOlipra',
      title: SITE_NAME,
      description: t.site.description,
      images: ['/img/og/default.jpg'],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <AppShell locale={lang}>{children}</AppShell>;
}
