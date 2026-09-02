import { POST } from '../route';
import { httpRequest } from '@/lib/httpRequest';
import { resolveAllConnections } from '@/lib/serverConnections';

jest.mock('@/lib/httpRequest');
jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  resolveAllConnections: jest.fn(),
}));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;
const mockResolveAll = resolveAllConnections as jest.MockedFunction<typeof resolveAllConnections>;

const request = (body: unknown) => ({ json: async () => body }) as never;

const CONNECTIONS = [
  { ip: '10.0.0.1', port: 80, username: 'admin', password: 'pw1' },
  { url: 'https://dns2.test', username: 'admin', password: 'pw2' },
];

/** Reads the SSE frames the route streamed back. */
async function messages(response: Response): Promise<string[]> {
  const stream = response.body as unknown as { events: () => Promise<{ message: string }[]> };
  return (await stream.events()).map(event => event.message);
}

describe('POST /api/set-filtering-rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAll.mockResolvedValue(CONNECTIONS);
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: '{"user_rules":[]}' });
  });

  it('rejects a missing domain', async () => {
    const response = await POST(request({ action: 'block' }));
    expect(response.status).toBe(400);
  });

  it('rejects an invalid action', async () => {
    const response = await POST(request({ domain: 'ads.test', action: 'nuke' }));
    expect(response.status).toBe(400);
  });

  it('rejects a domain containing rule syntax', async () => {
    const response = await POST(request({ domain: '||evil^$important', action: 'block' }));
    expect(response.status).toBe(400);
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it('adds a block rule while preserving existing rules', async () => {
    mockHttpRequest.mockImplementation(async ({ url }) =>
      url.includes('filtering/status')
        ? { statusCode: 200, headers: {}, body: '{"user_rules":["||keep.test^"]}' }
        : { statusCode: 200, headers: {}, body: '{}' });

    await POST(request({ domain: 'ads.test', action: 'block', connectionIds: ['10.0.0.1:80'] }));

    const setCall = mockHttpRequest.mock.calls.find(([opts]) => opts.url.includes('set_rules'));
    expect(JSON.parse(setCall![0].body as string)).toEqual({ rules: ['||keep.test^', '||ads.test^'] });
  });

  it('removes the opposing rule when switching to unblock', async () => {
    mockHttpRequest.mockImplementation(async ({ url }) =>
      url.includes('filtering/status')
        ? { statusCode: 200, headers: {}, body: '{"user_rules":["||ads.test^","||other.test^"]}' }
        : { statusCode: 200, headers: {}, body: '{}' });

    await POST(request({ domain: 'ads.test', action: 'unblock', connectionIds: ['10.0.0.1:80'] }));

    const setCall = mockHttpRequest.mock.calls.find(([opts]) => opts.url.includes('set_rules'));
    expect(JSON.parse(setCall![0].body as string)).toEqual({ rules: ['||other.test^', '@@||ads.test^'] });
  });

  it('skips writing when the rule already exists', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: '{"user_rules":["||ads.test^"]}' });

    const response = await POST(request({ domain: 'ads.test', action: 'block', connectionIds: ['10.0.0.1:80'] }));

    expect(await messages(response)).toContain('Rule already exists, skipping...');
  });

  it('applies to every connection when no ids are given', async () => {
    const response = await POST(request({ domain: 'ads.test', action: 'block' }));
    const log = await messages(response);

    expect(log[0]).toContain('on 2 server(s)');
    expect(log).toContain('Successfully applied rule on 10.0.0.1:80');
    expect(log).toContain('Successfully applied rule on https://dns2.test');
  });

  it('only touches the requested connections', async () => {
    const response = await POST(request({
      domain: 'ads.test', action: 'block', connectionIds: ['https://dns2.test'],
    }));
    const log = await messages(response);

    expect(log[0]).toContain('on 1 server(s)');
    expect(log.some(line => line.includes('10.0.0.1'))).toBe(false);
  });

  it('rejects a non-array connectionIds', async () => {
    expect((await POST(request({ domain: 'a.test', action: 'block', connectionIds: 'all' }))).status).toBe(400);
  });

  it('continues to the next server after a failure', async () => {
    mockHttpRequest.mockImplementation(async ({ url }) => {
      if (url.startsWith('http://10.0.0.1')) throw new Error('unreachable');
      return { statusCode: 200, headers: {}, body: '{"user_rules":[]}' };
    });

    const log = await messages(await POST(request({ domain: 'ads.test', action: 'block' })));

    expect(log.some(line => line.startsWith('Failed to apply rule on 10.0.0.1:80'))).toBe(true);
    expect(log).toContain('Successfully applied rule on https://dns2.test');
    expect(log[log.length - 1]).toBe('Finished.');
  });

  it('reports a server whose password could not be decrypted', async () => {
    mockResolveAll.mockResolvedValue([{ ip: '10.0.0.1', port: 80, username: 'admin', password: '' }]);

    const log = await messages(await POST(request({ domain: 'ads.test', action: 'block' })));

    expect(log.some(line => line.includes('Stored password could not be decrypted'))).toBe(true);
  });

  it('reports a non-2xx filtering status', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 403, headers: {}, body: '' });

    const log = await messages(await POST(request({
      domain: 'ads.test', action: 'block', connectionIds: ['10.0.0.1:80'],
    })));

    expect(log.some(line => line.includes('Failed to fetch filtering status: 403'))).toBe(true);
  });
});
