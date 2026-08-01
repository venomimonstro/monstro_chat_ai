import { splitLeadName, formatLeadFields } from './lead-delivery.types';

describe('lead-delivery.types', () => {
  it('splits full name into first and last', () => {
    expect(splitLeadName('Иван Петров')).toEqual({
      firstName: 'Иван',
      lastName: 'Петров',
    });
  });

  it('handles single name', () => {
    expect(splitLeadName('Иван')).toEqual({
      firstName: 'Иван',
      lastName: '',
    });
  });

  it('formats lead fields for delivery', () => {
    const fields = formatLeadFields({
      id: 'lead-1',
      tenantId: 't1',
      dialogId: 'd1',
      name: 'Анна Смирнова',
      phone: '+79990001122',
      email: 'anna@test.ru',
      utmJson: { utm_source: 'google', utm_campaign: 'spring' },
      referrer: 'https://google.com',
      landingPage: '/promo',
      externalId: null,
      externalCrmType: null,
      sourceName: 'Виджет',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    });

    expect(fields.firstName).toBe('Анна');
    expect(fields.lastName).toBe('Смирнова');
    expect(fields.phone).toBe('+79990001122');
    expect(fields.utm).toContain('google');
    expect(fields.source).toBe('Виджет');
  });
});
