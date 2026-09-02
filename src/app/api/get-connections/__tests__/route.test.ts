import { GET } from '../route';
import { getPublicStore } from '@/lib/serverConnections';

jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  getPublicStore: jest.fn(),
}));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetPublicStore = getPublicStore as jest.MockedFunction<typeof getPublicStore>;

describe('GET /api/get-connections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the public view of the store', async () => {
    mockGetPublicStore.mockResolvedValue({
      connections: [{ id: '10.0.0.1:80', ip: '10.0.0.1', port: 80, username: 'admin' }],
      masterServerIp: '10.0.0.1:80',
    });

    const data = await (await GET()).json();

    expect(data.masterServerIp).toBe('10.0.0.1:80');
    expect(data.connections).toHaveLength(1);
  });

  it('never exposes a password field', async () => {
    mockGetPublicStore.mockResolvedValue({
      connections: [{ id: 'https://a.test', url: 'https://a.test', username: 'admin' }],
      masterServerIp: null,
    });

    const data = await (await GET()).json();

    expect(JSON.stringify(data)).not.toContain('password');
    expect(data.connections[0]).not.toHaveProperty('password');
  });

  it('returns an empty store when nothing is configured', async () => {
    mockGetPublicStore.mockResolvedValue({ connections: [], masterServerIp: null });

    const data = await (await GET()).json();

    expect(data).toEqual({ connections: [], masterServerIp: null });
  });

  it('returns 500 with a parse message for corrupt JSON', async () => {
    mockGetPublicStore.mockRejectedValue(new SyntaxError('Unexpected token'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Failed to parse connections data.');
  });

  it('returns 500 for a read failure', async () => {
    mockGetPublicStore.mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Failed to read connections file.');
  });
});
