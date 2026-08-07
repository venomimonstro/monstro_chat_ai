import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WidgetSessionService } from './widget-session.service';

describe('WidgetSessionService', () => {
  const jwt = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
  } as unknown as JwtService;

  const config = {
    get: (_key: string, defaultVal: number) => defaultVal,
  } as unknown as ConfigService;

  let service: WidgetSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WidgetSessionService(jwt, config);
  });

  it('issues token with widget session claims', () => {
    const token = service.issueToken({
      widgetKey: 'wk-1',
      visitorId: 'v-1',
      dialogId: 'd-1',
    });
    expect(token).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'widget-session',
        widgetKey: 'wk-1',
        visitorId: 'v-1',
        dialogId: 'd-1',
      }),
      expect.objectContaining({ expiresIn: 86_400 }),
    );
  });

  it('accepts valid token', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      purpose: 'widget-session',
      widgetKey: 'wk-1',
      visitorId: 'v-1',
      dialogId: 'd-1',
    });
    expect(() =>
      service.assertToken('ok', {
        widgetKey: 'wk-1',
        visitorId: 'v-1',
        dialogId: 'd-1',
      }),
    ).not.toThrow();
  });

  it('rejects missing token', () => {
    expect(() =>
      service.assertToken(undefined, { widgetKey: 'wk-1', visitorId: 'v-1' }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects mismatched visitor', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      purpose: 'widget-session',
      widgetKey: 'wk-1',
      visitorId: 'other',
    });
    expect(() =>
      service.assertToken('tok', { widgetKey: 'wk-1', visitorId: 'v-1' }),
    ).toThrow(UnauthorizedException);
  });

  it('isValidToken returns false for invalid token', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid');
    });
    expect(
      service.isValidToken('bad', { widgetKey: 'wk-1', visitorId: 'v-1' }),
    ).toBe(false);
  });
});
