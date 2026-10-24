export const LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

export const localePath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? path : `/${locale}${path === '/' ? '' : path}`;

export const stripLocale = (pathname: string) => pathname.replace(/^\/(?:en|pl)(?=\/|$)/, '') || '/';

export const languageAlternates = (path: string) => ({
  ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
  'x-default': localePath(DEFAULT_LOCALE, path),
});

export const OG_LOCALE: Record<Locale, string> = { en: 'en_GB', pl: 'pl_PL' };
