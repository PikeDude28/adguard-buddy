import { middleware } from '../middleware';

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    body: unknown;
    _headers: Map<string, string>;

    constructor(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this._headers = new Map(Object.entries(init.headers ?? {}));
    }

    get headers() {
      return { get: (key: string) => this._headers.get(key) ?? null };
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

const request = (authorization?: string) => ({
  headers: { get: (key: string) => (key === 'authorization' ? authorization ?? null : null) },
}) as never;

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

describe('middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('passes everything through when auth is not configured', () => {
    delete process.env.ADGUARD_BUDDY_AUTH_USER;
    delete process.env.ADGUARD_BUDDY_AUTH_PASSWORD;

    expect(middleware(request()).status).toBe(200);
  });

  it('passes through when only a username is configured', () => {
    process.env.ADGUARD_BUDDY_AUTH_USER = 'admin';
    delete process.env.ADGUARD_BUDDY_AUTH_PASSWORD;

    expect(middleware(request()).status).toBe(200);
  });

  describe('with credentials configured', () => {
    beforeEach(() => {
      process.env.ADGUARD_BUDDY_AUTH_USER = 'admin';
      process.env.ADGUARD_BUDDY_AUTH_PASSWORD = 'sesame';
    });

    it('challenges an unauthenticated request', () => {
      const response = middleware(request());

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic realm="AdGuard Buddy"');
    });

    it('accepts the correct credentials', () => {
      expect(middleware(request(basic('admin', 'sesame'))).status).toBe(200);
    });

    it('rejects a wrong password', () => {
      expect(middleware(request(basic('admin', 'wrong'))).status).toBe(401);
    });

    it('rejects a wrong username', () => {
      expect(middleware(request(basic('root', 'sesame'))).status).toBe(401);
    });

    it('rejects a non-basic scheme', () => {
      expect(middleware(request('Bearer token')).status).toBe(401);
    });

    it('rejects an undecodable header', () => {
      expect(middleware(request('Basic !!!not-base64!!!')).status).toBe(401);
    });

    it('rejects a header without a colon separator', () => {
      expect(middleware(request(`Basic ${Buffer.from('adminsesame').toString('base64')}`)).status).toBe(401);
    });

    it('accepts a password that contains colons', () => {
      process.env.ADGUARD_BUDDY_AUTH_PASSWORD = 'a:b:c';
      expect(middleware(request(basic('admin', 'a:b:c'))).status).toBe(200);
    });
  });
});
