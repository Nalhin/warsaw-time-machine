'use client';

import { createContext, useContext } from 'react';

import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

interface LocaleProviderProps {
  locale: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useMessages() {
  return MESSAGES[useLocale()];
}
