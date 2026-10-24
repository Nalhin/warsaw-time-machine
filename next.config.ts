import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1600],
  },
  async redirects() {
    return [
      { source: '/s/:id', destination: '/spots/:id', permanent: true },
      {
        source: '/',
        has: [{ type: 'query', key: 'spot', value: '(?<id>[a-z0-9-]+)' }],
        destination: '/spots/:id',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/img/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default config;
