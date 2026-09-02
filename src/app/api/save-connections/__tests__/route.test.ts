import { POST } from '../route';
import { readMigratedStore, writeStore, getPublicStore } from '@/lib/serverConnections';
import { decryptPassword, isEncrypted } from '@/lib/crypto';

jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  readMigratedStore: jest.fn(),
  writeStore: jest.fn(),
  getPublicStore: jest.fn(),
}));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockRead = readMigratedStore as jest.MockedFunction<typeof readMigratedStore>;
const mockWrite = writeStore as jest.MockedFunction<typeof writeStore>;
const mockPublic = getPublicStore as jest.MockedFunction<typeof getPublicStore>;

const request = (body: unknown) => ({ json: async () => body }) as never;

describe('POST /api/save-connections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockResolvedValue({ connections: [], masterServerIp: null });
    mockPublic.mockResolvedValue({ connections: [], masterServerIp: null });
  });

  it('encrypts a new plaintext password before writing it', async () => {
    const response = await POST(request({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: 'super-secret' }],
      masterServerIp: null,
    }));

    expect(response.status).toBe(200);
    const written = mockWrite.mock.calls[0][0];
    expect(written.connections[0].password).not.toBe('super-secret');
    expect(isEncrypted(written.connections[0].password)).toBe(true);
    expect(decryptPassword(written.connections[0].password)).toBe('super-secret');
  });

  it('keeps the stored ciphertext when no password is supplied', async () => {
    mockRead.mockResolvedValue({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: 'v2:existing-cipher' }],
      masterServerIp: null,
    });

    await POST(request({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'renamed', color: '#fff' }],
      masterServerIp: null,
    }));

    const written = mockWrite.mock.calls[0][0];
    expect(written.connections[0].password).toBe('v2:existing-cipher');
    expect(written.connections[0].username).toBe('renamed');
  });

  it('rejects a new connection without a password', async () => {
    const response = await POST(request({
      connections: [{ ip: '10.0.0.9', port: 80, username: 'admin' }],
      masterServerIp: null,
    }));

    expect(response.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('rejects a connection with neither ip nor url', async () => {
    const response = await POST(request({ connections: [{ username: 'admin', password: 'x' }] }));
    expect(response.status).toBe(400);
  });

  it('rejects a non-http scheme', async () => {
    const response = await POST(request({
      connections: [{ url: 'file:///etc/passwd', username: 'admin', password: 'x' }],
    }));
    expect(response.status).toBe(400);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('rejects a payload that is not an array of connections', async () => {
    expect((await POST(request({ connections: 'everything' }))).status).toBe(400);
  });

  it('rejects an out-of-range port', async () => {
    const response = await POST(request({
      connections: [{ ip: '10.0.0.1', port: 999999, username: 'admin', password: 'x' }],
    }));
    expect(response.status).toBe(400);
  });

  it('drops a master id that matches no connection', async () => {
    await POST(request({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: 'x' }],
      masterServerIp: 'somewhere.else',
    }));

    expect(mockWrite.mock.calls[0][0].masterServerIp).toBeNull();
  });

  it('keeps a master id that matches a connection', async () => {
    await POST(request({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: 'x' }],
      masterServerIp: '10.0.0.1:80',
    }));

    expect(mockWrite.mock.calls[0][0].masterServerIp).toBe('10.0.0.1:80');
  });

  it('returns 500 when the write fails', async () => {
    mockWrite.mockRejectedValue(new Error('read-only filesystem'));

    const response = await POST(request({
      connections: [{ ip: '10.0.0.1', port: 80, username: 'admin', password: 'x' }],
    }));

    expect(response.status).toBe(500);
  });
});
