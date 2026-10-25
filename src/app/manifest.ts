import type { MetadataRoute } from 'next';

import { MESSAGES } from '@/lib/messages';
import { SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: MESSAGES.en.site.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#111214',
    theme_color: '#111214',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
