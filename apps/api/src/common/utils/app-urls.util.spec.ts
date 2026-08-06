import { ConfigService } from '@nestjs/config';
import {
  isAdminOrigin,
  originMatchesAppUrls,
  parseAppUrls,
  refererMatchesAdmin,
} from './app-urls.util';

describe('app-urls.util', () => {
  const adminUrls = [
    'https://redflow.ru/admin',
    'http://31.128.42.106:5174',
    'http://31.128.42.106',
  ];

  it('parseAppUrls reads comma-separated WEB_ADMIN_URLS', () => {
    const config = {
      get: (key: string, fallback?: string) => {
        if (key === 'WEB_ADMIN_URLS') {
          return 'http://a:5174, http://b/admin';
        }
        if (key === 'WEB_ADMIN_URL') return fallback;
        return fallback;
      },
    } as ConfigService;

    expect(parseAppUrls(config, 'WEB_ADMIN_URL', 'http://localhost:5174')).toEqual([
      'http://a:5174',
      'http://b/admin',
    ]);
  });

  it('originMatchesAppUrls matches shared host when admin has path', () => {
    expect(originMatchesAppUrls('https://redflow.ru', adminUrls)).toBe(true);
    expect(originMatchesAppUrls('http://31.128.42.106:5174', adminUrls)).toBe(true);
  });

  it('isAdminOrigin detects dev port and explicit admin URL', () => {
    expect(isAdminOrigin('http://31.128.42.106:5174', adminUrls)).toBe(true);
    expect(isAdminOrigin('https://redflow.ru', adminUrls)).toBe(false);
  });

  it('refererMatchesAdmin detects admin path on shared host', () => {
    expect(
      refererMatchesAdmin('https://redflow.ru/admin/login', adminUrls),
    ).toBe(true);
    expect(refererMatchesAdmin('https://redflow.ru/app/dashboard', adminUrls)).toBe(
      false,
    );
  });
});
