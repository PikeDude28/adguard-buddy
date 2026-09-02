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

describe('POST /api/refresh-filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({ ip: '10.0.0.1', port: 80, username: 'admin', password: 'pw' });
  });

  it('posts a blocklist refresh with a long timeout', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: '{"updated":3}' });

    const data = await (await POST(request({ connectionId: '10.0.0.1:80' }))).json();

    expect(data.success).toBe(true);
    expect(data.data).toEqual({ updated: 3 });
    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://10.0.0.1:80/control/filtering/refresh',
      body: JSON.stringify({ whitelist: false }),
      timeoutMs: 60000,
    }));
  });

  it('falls back to a generic payload for a non-JSON body', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: 'OK' });

    const data = await (await POST(request({ connectionId: '10.0.0.1:80' }))).json();

    expect(data.data).toEqual({ message: 'Refresh triggered' });
  });

  it('propagates a failing status', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 502, headers: {}, body: 'upstream down' });

    const response = await POST(request({ connectionId: '10.0.0.1:80' }));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
  });

  it('rejects a missing connectionId', async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    expect((await POST(request({ connectionId: 'ghost' }))).status).toBe(404);
  });

  it('returns 500 when the request throws', async () => {
    mockHttpRequest.mockRejectedValue(new Error('socket hang up'));
    expect((await POST(request({ connectionId: '10.0.0.1:80' }))).status).toBe(500);
  });
});
