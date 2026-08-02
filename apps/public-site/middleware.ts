import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildContentSecurityPolicy(): string {
  const widgetUrl = (process.env.NEXT_PUBLIC_WIDGET_URL ?? 'http://localhost:5175').replace(
    /\/$/,
    '',
  );
  const clientUrl = (process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:5173').replace(
    /\/$/,
    '',
  );
  const internalApiUrl = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const publicApiOrigin = publicApiUrl.startsWith('http')
    ? new URL(publicApiUrl).origin
    : '';

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: ${widgetUrl}`,
    `style-src 'self' 'unsafe-inline' https:`,
    `img-src 'self' data: blob: https: http:`,
    `font-src 'self' https: data:`,
    `connect-src 'self' https: wss: http: ${internalApiUrl} ${widgetUrl} ${clientUrl} ${publicApiOrigin}`.trim(),
    `frame-src 'self' https: http: ${widgetUrl}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: '/:path*',
};
