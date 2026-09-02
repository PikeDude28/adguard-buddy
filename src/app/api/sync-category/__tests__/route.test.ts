import { POST } from '../route';
import { resolveConnection } from '@/lib/serverConnections';
import { performCategorySync } from '../sync-logic';

jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  resolveConnection: jest.fn(),
}));
jest.mock('../sync-logic', () => ({ performCategorySync: jest.fn() }));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockResolve = resolveConnection as jest.MockedFunction<typeof resolveConnection>;
const mockSync = performCategorySync as jest.MockedFunction<typeof performCategorySync>;

const request = (body: unknown) => ({ json: async () => body }) as never;

const MASTER = { ip: '192.168.1.1', port: 80, username: 'admin', password: 'master-pw' };
const REPLICA = { ip: '192.168.1.2', port: 80, username: 'admin', password: 'replica-pw' };

async function messages(response: Response): Promise<string[]> {
  const stream = response.body as unknown as { events: () => Promise<{ message: string }[]> };
  return (await stream.events()).map(event => event.message);
}

describe('POST /api/sync-category', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockImplementation(async id => (id === 'master' ? MASTER : id === 'replica' ? REPLICA : null));
    mockSync.mockResolvedValue(undefined);
  });

  it('rejects a missing sourceId', async () => {
    const response = await POST(request({ destinationId: 'replica', category: 'filtering' }));
    expect(response.status).toBe(400);
  });

  it('rejects a missing destinationId', async () => {
    const response = await POST(request({ sourceId: 'master', category: 'filtering' }));
    expect(response.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const response = await POST(request({ sourceId: 'master', destinationId: 'replica', category: 'everything' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('category');
  });

  it('rejects syncing a server onto itself', async () => {
    const response = await POST(request({ sourceId: 'master', destinationId: 'master', category: 'filtering' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain('must be different');
  });

  it('returns 404 when the source does not exist', async () => {
    const response = await POST(request({ sourceId: 'ghost', destinationId: 'replica', category: 'filtering' }));
    expect(response.status).toBe(404);
  });

  it('returns 404 when the destination does not exist', async () => {
    const response = await POST(request({ sourceId: 'master', destinationId: 'ghost', category: 'filtering' }));
    expect(response.status).toBe(404);
  });

  it('resolves both connections server-side and streams progress', async () => {
    const response = await POST(request({ sourceId: 'master', destinationId: 'replica', category: 'filtering' }));

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    const log = await messages(response);
    expect(log[0]).toBe('SYNC: Process started');
    expect(log).toContain('Done.');

    expect(mockSync).toHaveBeenCalledWith(MASTER, REPLICA, 'filtering', expect.any(Function));
  });

  it('streams the error instead of throwing when the sync fails', async () => {
    mockSync.mockRejectedValue(new Error('replica unreachable'));

    const log = await messages(await POST(request({
      sourceId: 'master', destinationId: 'replica', category: 'rewrites',
    })));

    expect(log).toContain('SYNC ERROR: replica unreachable');
    expect(log).toContain('ERROR: replica unreachable');
  });

  it('returns 500 when the credential store cannot be read', async () => {
    mockResolve.mockRejectedValue(new Error('disk failure'));

    const response = await POST(request({ sourceId: 'master', destinationId: 'replica', category: 'filtering' }));
    expect(response.status).toBe(500);
  });
});
