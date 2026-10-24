import 'leaflet/dist/leaflet.css';
import '@/app/globals.css';

import type { Viewport } from 'next';
import { Inter } from 'next/font/google';

import { LocaleProvider } from '@/components/LocaleProvider';
import { MapApp } from '@/components/MapApp';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Locale } from '@/lib/i18n';
import { spotsFor } from '@/lib/spot-data';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#111214',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

interface AppShellProps {
  locale: Locale;
  children: React.ReactNode;
}

export function AppShell({ locale, children }: AppShellProps) {
  return (
    <html lang={locale} className={`dark ${inter.variable}`}>
      <body>
        <LocaleProvider locale={locale}>
          <TooltipProvider delayDuration={300}>
            <div className="isolate">
              <MapApp spots={spotsFor(locale)} />
            </div>
            <div className="isolate">{children}</div>
          </TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
