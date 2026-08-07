import type { Source } from '@prisma/client';
import { isWidgetOriginAllowed } from './widget-origin.util';

const source = { id: 's1' } as Source;

const sourcesService = {
  getAllowedOrigins: () => [] as string[],
};

describe('isWidgetOriginAllowed', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevWidget = process.env.WIDGET_URL;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    process.env.WIDGET_URL = prevWidget;
  });

  it('allows empty allowlist in development', () => {
    process.env.NODE_ENV = 'development';
    expect(
      isWidgetOriginAllowed(sourcesService as never, source, 'https://evil.com'),
    ).toBe(true);
  });

  it('denies empty allowlist in production for customer origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.WIDGET_URL = 'http://localhost:5175';
    expect(
      isWidgetOriginAllowed(sourcesService as never, source, 'https://client.com'),
    ).toBe(false);
  });

  it('always allows WIDGET_URL iframe origin in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.WIDGET_URL = 'http://31.128.42.106:5175';
    expect(
      isWidgetOriginAllowed(
        sourcesService as never,
        source,
        'http://31.128.42.106:5175',
      ),
    ).toBe(true);
  });

  it('checks parentOrigin against allowlist when iframe origin is widget host', () => {
    process.env.NODE_ENV = 'production';
    process.env.WIDGET_URL = 'http://31.128.42.106:5175';
    const svc = {
      getAllowedOrigins: () => ['https://client.com'],
    };
    expect(
      isWidgetOriginAllowed(
        svc as never,
        source,
        'http://31.128.42.106:5175',
        undefined,
        'https://client.com',
      ),
    ).toBe(true);
    expect(
      isWidgetOriginAllowed(
        svc as never,
        source,
        'http://31.128.42.106:5175',
        undefined,
        'https://evil.com',
      ),
    ).toBe(false);
  });

  it('allows matching customer origin when allowlist is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.WIDGET_URL = 'http://localhost:5175';
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
