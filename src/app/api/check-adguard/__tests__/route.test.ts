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

const CONNECTION = {
  ip: '192.168.1.10',
  port: 80,
  username: 'admin',
  password: 'plaintext-secret',
  allowInsecure: false,
};

describe('POST /api/check-adguard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue(CONNECTION);
  });

  it('returns connected with parsed stats for a known connection', async () => {
    mockHttpRequest
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{"version":"v0.107.0"}' })
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{"num_dns_queries":42}' });

    const response = await POST(request({ connectionId: '192.168.1.10:80' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('connected');
    expect(data.stats).toEqual({ num_dns_queries: 42 });
    expect(mockResolve).toHaveBeenCalledWith('192.168.1.10:80');
  });

  it('never accepts credentials from the request body', async () => {
    mockHttpRequest
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{}' })
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{}' });

    await POST(request({ connectionId: '192.168.1.10:80', password: 'attacker-supplied', ip: 'evil.example' }));

    // The URL comes from the stored connection, not from the body.
    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://192.168.1.10:80/control/status',
      headers: { Authorization: 'Basic ' + Buffer.from('admin:plaintext-secret').toString('base64') },
    }));
  });

  it('rejects a body without a connectionId', async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    const response = await POST(request({ connectionId: 'nope' }));
    expect(response.status).toBe(404);
  });

  it('returns 502 when the server is unreachable', async () => {
    mockHttpRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const response = await POST(request({ connectionId: '192.168.1.10:80' }));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.message).toContain('ECONNREFUSED');
  });

  it('reports error status but still returns the body for a non-2xx status', async () => {
    mockHttpRequest
      .mockResolvedValueOnce({ statusCode: 401, headers: {}, body: 'Unauthorized' })
      .mockResolvedValueOnce({ statusCode: 401, headers: {}, body: '' });

    const data = await (await POST(request({ connectionId: '192.168.1.10:80' }))).json();

    expect(data.status).toBe('error');
    expect(data.code).toBe(401);
    expect(data.response).toBe('Unauthorized');
  });

  it('returns null stats when the stats endpoint fails', async () => {
    mockHttpRequest
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{}' })
      .mockRejectedValueOnce(new Error('boom'));

    const data = await (await POST(request({ connectionId: '192.168.1.10:80' }))).json();

    expect(data.status).toBe('connected');
    expect(data.stats).toBeNull();
  });

  it('returns 500 when reading the credential store fails', async () => {
    mockResolve.mockRejectedValue(new Error('disk on fire'));
    const response = await POST(request({ connectionId: 'x' }));
    expect(response.status).toBe(500);
  });

  it('uses the stored URL when the connection has one', async () => {
    mockResolve.mockResolvedValue({ ...CONNECTION, ip: undefined, url: 'https://adguard.local/' });
    mockHttpRequest
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{}' })
      .mockResolvedValueOnce({ statusCode: 200, headers: {}, body: '{}' });

    await POST(request({ connectionId: 'https://adguard.local' }));

    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://adguard.local/control/status',
    }));
  });
});
