'use client';

import { createContext, useContext } from 'react';

import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = () => useContext(LocaleContext);

export const useMessages = () => MESSAGES[useLocale()];
