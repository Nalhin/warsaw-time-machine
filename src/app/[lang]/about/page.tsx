import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AboutPanel } from '@/components/about-dialog';
import { isLocale, languageAlternates, localePath } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { socialMetadata } from '@/lib/social-metadata';
import { AUTHOR_ID, AUTHOR_NODE, jsonLdScript, WARSAW, WEBSITE_ID, websiteNode } from '@/lib/structured-data';

interface AboutPageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = MESSAGES[lang];
  return {
    title: { absolute: t.about.title },
    description: t.about.description,
    alternates: { canonical: localePath(lang, '/about'), languages: languageAlternates('/about') },
    ...socialMetadata(lang, {
      type: 'article',
      title: t.about.title,
      description: t.about.description,
      url: localePath(lang, '/about'),
      image: '/img/og/default.jpg',
      alt: t.site.ogAlt,
    }),
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = MESSAGES[lang];
  const url = `${SITE_URL}${localePath(lang, '/about')}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      websiteNode(lang),
      AUTHOR_NODE,
      {
        '@type': 'AboutPage',
        '@id': url,
        url,
        name: t.about.title,
        description: t.about.description,
        inLanguage: lang,
        isPartOf: { '@id': WEBSITE_ID },
        author: { '@id': AUTHOR_ID },
        mainEntity: { '@id': WEBSITE_ID },
        about: WARSAW,
        text: t.about.story.join('\n\n'),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}${localePath(lang, '/')}` },
          { '@type': 'ListItem', position: 2, name: t.about.label, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <AboutPanel />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
    </>
  );
}
