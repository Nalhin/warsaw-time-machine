export const LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function localePath(locale: Locale, path: string) {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path === '/' ? '' : path}`;
}

export function stripLocale(pathname: string) {
  return pathname.replace(/^\/(?:en|pl)(?=\/|$)/, '') || '/';
}

export function languageAlternates(path: string) {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
    'x-default': localePath(DEFAULT_LOCALE, path),
  };
}

export const OG_LOCALE: Record<Locale, string> = { en: 'en_GB', pl: 'pl_PL' };
