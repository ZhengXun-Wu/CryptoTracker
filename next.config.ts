import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const noStore = { key: 'Cache-Control', value: 'no-store' };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  outputFileTracingIncludes: {
    '/': ['./data/example-leaderboard.json'],
    '/api/leaderboard': ['./data/example-leaderboard.json'],
    '/api/ingest': ['./data/example-leaderboard.json'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/', headers: [noStore] },
      { source: '/login', headers: [noStore] },
      { source: '/api/:path*', headers: [noStore] },
    ];
  },
};

export default nextConfig;
