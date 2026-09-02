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

describe('POST /api/statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({ url: 'https://dns.example', username: 'admin', password: 'pw' });
  });

  it('returns the parsed stats payload', async () => {
    mockHttpRequest.mockResolvedValue({
      statusCode: 200, headers: {}, body: '{"num_dns_queries":10,"dns_queries":[1,2,3]}',
    });

    const response = await POST(request({ connectionId: 'https://dns.example' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.num_dns_queries).toBe(10);
    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://dns.example/control/stats',
    }));
  });

  it('rejects a missing connectionId', async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    expect((await POST(request({ connectionId: 'x' }))).status).toBe(404);
  });

  it('returns 502 for a non-2xx response', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 500, headers: {}, body: 'nope' });
    expect((await POST(request({ connectionId: 'https://dns.example' }))).status).toBe(502);
  });

  it('returns 502 when the request throws', async () => {
    mockHttpRequest.mockRejectedValue(new Error('unreachable'));
    expect((await POST(request({ connectionId: 'https://dns.example' }))).status).toBe(502);
  });
});
