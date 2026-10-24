import type { Metadata } from 'next';

import { isLocale, languageAlternates, localePath } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { ogImagePath, readOgScene } from '@/lib/og-scene';
import { socialMetadata } from '@/lib/social-metadata';

export { default } from '../page';

interface ViewPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function toSearch(params: Record<string, string | string[] | undefined>) {
  return new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) => [value ?? []].flat().map((v) => [key, v])),
  ).toString();
}

export async function generateMetadata({ params, searchParams }: ViewPageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = MESSAGES[lang];
  const scene = readOgScene(toSearch(await searchParams));
  const title = t.site.viewTitle(scene.years.map((y) => t.years[y].label));
  return {
    title,
    alternates: { canonical: localePath(lang, '/'), languages: languageAlternates('/') },
    ...socialMetadata(lang, {
      type: 'website',
      title,
      description: t.site.description,
      url: `${localePath(lang, '/')}${scene.query}`,
      image: ogImagePath(scene, lang),
      alt: title,
    }),
  };
}
