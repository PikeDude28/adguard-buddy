import { POST } from '../route';
import { httpRequest } from '@/lib/httpRequest';
import { resolveConnection } from '@/lib/serverConnections';

jest.mock('@/lib/httpRequest');
jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  resolveConnection: jest.fn(),
}));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;
const mockResolve = resolveConnection as jest.MockedFunction<typeof resolveConnection>;
const request = (body: unknown) => ({ json: async () => body }) as never;

const okResponse = { statusCode: 200, headers: {}, body: '{"data":[]}' };

describe('POST /api/query-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({ ip: '1.2.3.4', port: 80, username: 'u', password: 'p' });
    mockHttpRequest.mockResolvedValue(okResponse);
  });

  it('applies defaults for limit, offset and status', async () => {
    await POST(request({ connectionId: '1.2.3.4:80' }));

    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://1.2.3.4:80/control/querylog?limit=100&offset=0&response_status=all',
    }));
  });

  it('passes through valid query parameters', async () => {
    await POST(request({ connectionId: '1.2.3.4:80', limit: 25, offset: 50, response_status: 'blocked_parental' }));

    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://1.2.3.4:80/control/querylog?limit=25&offset=50&response_status=blocked_parental',
    }));
  });

  it('rejects an out-of-range limit', async () => {
    const response = await POST(request({ connectionId: '1.2.3.4:80', limit: 99999 }));
    expect(response.status).toBe(400);
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it('rejects an unknown response_status instead of forwarding it', async () => {
    const response = await POST(request({ connectionId: '1.2.3.4:80', response_status: 'x"&injected' }));
    expect(response.status).toBe(400);
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it('returns 502 for a non-2xx AdGuard response', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 401, headers: {}, body: '' });
    expect((await POST(request({ connectionId: '1.2.3.4:80' }))).status).toBe(502);
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    expect((await POST(request({ connectionId: 'ghost' }))).status).toBe(404);
  });
});
