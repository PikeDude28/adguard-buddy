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

const CONNECTION = { ip: '10.0.0.1', port: 3000, username: 'admin', password: 'pw', allowInsecure: false };

describe('POST /api/adguard-control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue(CONNECTION);
  });

  it('posts the requested protection state to dns_config', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: '{}' });

    const response = await POST(request({ connectionId: '10.0.0.1:3000', protection_enabled: false }));

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: 'http://10.0.0.1:3000/control/dns_config',
      body: JSON.stringify({ protection_enabled: false }),
    }));
  });

  it('rejects a non-boolean protection_enabled', async () => {
    const response = await POST(request({ connectionId: '10.0.0.1:3000', protection_enabled: 'yes' }));
    expect(response.status).toBe(400);
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it('rejects a missing connectionId', async () => {
    const response = await POST(request({ protection_enabled: true }));
    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    const response = await POST(request({ connectionId: 'ghost', protection_enabled: true }));
    expect(response.status).toBe(404);
  });

  it('propagates a non-2xx status from AdGuard', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 403, headers: {}, body: 'forbidden' });

    const response = await POST(request({ connectionId: '10.0.0.1:3000', protection_enabled: true }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain('forbidden');
  });

  it('returns 502 when the server cannot be reached', async () => {
    mockHttpRequest.mockRejectedValue(new Error('ETIMEDOUT'));
    const response = await POST(request({ connectionId: '10.0.0.1:3000', protection_enabled: true }));
    expect(response.status).toBe(502);
  });
});
