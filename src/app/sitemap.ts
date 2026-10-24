import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';
import { SPOTS } from '@/lib/spots';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    ...SPOTS.map((s) => ({
      url: `${SITE_URL}/spots/${s.id}`,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
      images: s.photos.map((p) => `${SITE_URL}${p.src}`),
    })),
  ];
}
