/** @type {import('next').NextConfig} */
const internalApiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@ai-consultant/shared-types'],
  async rewrites() {
    return [
      {
        source: '/api/public/:path*',
        destination: `${internalApiUrl}/api/public/:path*`,
      },
      {
        source: '/api/widget/:path*',
        destination: `${internalApiUrl}/api/widget/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${internalApiUrl}/api/auth/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${internalApiUrl}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
