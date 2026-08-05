import type { Source } from '@prisma/client';
import { isWidgetOriginAllowed } from './widget-origin.util';

const source = { id: 's1' } as Source;

const sourcesService = {
  getAllowedOrigins: () => [] as string[],
};

describe('isWidgetOriginAllowed', () => {
  const prevEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it('allows empty allowlist in development', () => {
    process.env.NODE_ENV = 'development';
    expect(
      isWidgetOriginAllowed(sourcesService as never, source, 'https://evil.com'),
    ).toBe(true);
  });

  it('denies empty allowlist in production', () => {
    process.env.NODE_ENV = 'production';
    expect(
      isWidgetOriginAllowed(sourcesService as never, source, 'https://client.com'),
    ).toBe(false);
  });

  it('allows matching origin when allowlist is set', () => {
    process.env.NODE_ENV = 'production';
    const svc = {
      getAllowedOrigins: () => ['https://client.com'],
    };
    expect(
      isWidgetOriginAllowed(svc as never, source, 'https://client.com'),
    ).toBe(true);
    expect(
      isWidgetOriginAllowed(svc as never, source, 'https://evil.com'),
    ).toBe(false);
  });
});
