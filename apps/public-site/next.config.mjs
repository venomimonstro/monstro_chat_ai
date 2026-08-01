/** @type {import('next').NextConfig} */
const internalApiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL ?? 'http://localhost:5175';
const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:5173';
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-consultant/shared-types'],
  async rewrites() {
    return [
      {
        source: '/api/public/:path*',
        destination: `${internalApiUrl}/api/public/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${internalApiUrl}/api/auth/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${widgetUrl}`,
              `style-src 'self' 'unsafe-inline'`,
              `img-src 'self' data: blob:`,
              `font-src 'self'`,
              `connect-src 'self' ${internalApiUrl} ${widgetUrl} ${clientUrl} ${publicApiUrl.startsWith('http') ? new URL(publicApiUrl).origin : ''}`.trim(),
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
