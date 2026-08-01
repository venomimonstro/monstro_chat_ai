import {
  attributionToUtmJson,
  leadAttributionFromDialog,
  toAttributionDto,
} from './attribution.util';

describe('attribution.util', () => {
  it('maps UTM fields to utm_json', () => {
    expect(
      attributionToUtmJson({
        utmSource: 'test',
        utmCampaign: 'demo',
      }),
    ).toEqual({
      utm_source: 'test',
      utm_campaign: 'demo',
    });
  });

  it('copies dialog attribution to lead payload', () => {
    expect(
      leadAttributionFromDialog({
        utmJson: { utm_source: 'google' },
        referrer: 'https://google.com',
        landingPage: 'https://site.ru/page',
        yandexClientId: 'ym-1',
        gaClientId: 'ga-1',
      }),
    ).toEqual({
      utmJson: { utm_source: 'google' },
      referrer: 'https://google.com',
      landingPage: 'https://site.ru/page',
      yandexClientId: 'ym-1',
      gaClientId: 'ga-1',
    });
  });

  it('builds attribution DTO for API response', () => {
    expect(
      toAttributionDto({
        utmJson: { utm_source: 'test', utm_campaign: 'demo' },
        referrer: 'ref',
        landingPage: 'lp',
        yandexClientId: 'ym',
        gaClientId: 'ga',
      }),
    ).toEqual({
      utmSource: 'test',
      utmMedium: null,
      utmCampaign: 'demo',
      utmContent: null,
      utmTerm: null,
      referrer: 'ref',
      landingPage: 'lp',
      yandexClientId: 'ym',
      gaClientId: 'ga',
    });
  });
});
