import 'leaflet/dist/leaflet.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist } from 'next/font/google';

import { MapApp } from '@/components/MapApp';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { SPOTS } from '@/lib/spots';

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist' });
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', axes: ['opsz'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: AUTHOR.website }],
  creator: AUTHOR.name,
  keywords: [
    'Warsaw',
    'Warszawa',
    'history',
    'aerial photos',
    '1935',
    '1945',
    'before and after',
    'pre-war Warsaw',
    'Warsaw destruction',
    'rephotography',
    'Warsaw Time Machine',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/img/og/default.jpg', width: 1200, height: 630, alt: 'Warsaw in 1935, 1945 and today, side by side' }],
  },
  twitter: { card: 'summary_large_image', creator: '@KrzysztofOlipra', title: SITE_NAME, description: SITE_DESCRIPTION, images: ['/img/og/default.jpg'] },
};

export const viewport: Viewport = {
  themeColor: '#111214',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${fraunces.variable}`}>
      <body>
        <TooltipProvider delayDuration={300}>
          <div className="isolate">
            <MapApp spots={SPOTS} />
          </div>
          <div className="isolate">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
