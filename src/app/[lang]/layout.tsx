import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { isLocale, languageAlternates, LOCALES, localePath } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { AUTHOR, SITE_NAME, SITE_URL } from '@/lib/site';
import { socialMetadata } from '@/lib/social-metadata';
import { YEAR_KEYS } from '@/lib/years';

export { viewport } from '@/components/app-shell';

interface LocaleParams {
  params: Promise<{ lang: string }>;
}

interface LocaleLayoutProps extends LocaleParams {
  children: React.ReactNode;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
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
    ...socialMetadata(lang, {
      type: 'website',
      title: SITE_NAME,
      description: t.site.description,
      url: localePath(lang, '/'),
      image: '/img/og/default.jpg',
      alt: t.site.ogAlt,
    }),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <AppShell locale={lang}>{children}</AppShell>;
}
