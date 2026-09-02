import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import SyncStatusPage from '../page';
import { useConnections } from '../../contexts/ConnectionsContext';
import { connection, mockConnectionsValue, renderWithProviders } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const MASTER_SETTINGS = {
  filtering: {
    enabled: true,
    interval: 24,
    user_rules: ['||ads.test^'],
    filters: [{ url: 'https://a.test/l.txt', name: 'List A', enabled: true }],
    whitelist_filters: [],
  },
  rewrites: [],
};

const DRIFTED_SETTINGS = {
  filtering: {
    enabled: false,
    interval: 24,
    user_rules: [],
    filters: [],
    whitelist_filters: [],
  },
  rewrites: [],
};

const AUTO_SYNC = {
  config: { enabled: true, interval: '1hour', categories: ['filtering'], lastSync: 1_700_000_000_000 },
  isRunning: false,
  isPaused: false,
  nextSync: null,
  recentLogs: [
    { timestamp: 1_700_000_000_000, replicaId: '10.0.0.2:80', category: 'filtering', status: 'success', message: 'ok', duration: 120 },
    { timestamp: 1_700_000_100_000, replicaId: '10.0.0.2:80', category: 'rewrites', status: 'error', message: 'boom' },
  ],
};

const TWO_SERVERS = mockConnectionsValue({
  connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
  masterServerId: '192.168.1.1:80',
});

function mockFetch(replicaSettings: unknown = DRIFTED_SETTINGS) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('auto-sync-config')) {
      return { ok: true, status: 200, json: async () => AUTO_SYNC } as unknown as Response;
    }
    if (String(url).includes('get-all-settings')) {
      const { connectionId } = JSON.parse(init!.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          settings: connectionId === '192.168.1.1:80' ? MASTER_SETTINGS : replicaSettings,
          errors: {},
        }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  });
}

describe('SyncStatusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(TWO_SERVERS);
    global.fetch = mockFetch() as unknown as typeof fetch;
  });

  it('fetches settings for each server by connection id', async () => {
    renderWithProviders(<SyncStatusPage />);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
        .filter(([url]) => String(url).includes('get-all-settings'))
        .map(([, init]) => JSON.parse(init.body).connectionId);
      expect(calls).toEqual(expect.arrayContaining(['192.168.1.1:80', '10.0.0.2:80']));
    });
  });

  it('reports drift between the master and a replica', async () => {
    renderWithProviders(<SyncStatusPage />);

    await waitFor(() => expect(screen.getByText('10.0.0.2:80')).toBeInTheDocument());
    expect(screen.getByText(/differences/)).toBeInTheDocument();
    expect(screen.getByText('Filtering')).toBeInTheDocument();
  });

  it('marks a matching replica as in sync', async () => {
    global.fetch = mockFetch(MASTER_SETTINGS) as unknown as typeof fetch;

    renderWithProviders(<SyncStatusPage />);

    // "In sync" is also a KPI label, so assert on the replica card's own copy.
    await waitFor(() =>
      expect(screen.getByText('Every syncable category matches the master.')).toBeInTheDocument());
    expect(screen.getAllByText('In sync').length).toBeGreaterThan(1);
  });

  it('shows field-level differences when a category is expanded', async () => {
    renderWithProviders(<SyncStatusPage />);
    await waitFor(() => expect(screen.getByText('Filtering')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Filtering'));

    expect(screen.getByText('Filtering enabled')).toBeInTheDocument();
    expect(screen.getByText('Custom rules')).toBeInTheDocument();
    expect(screen.getByText('List A')).toBeInTheDocument();
  });

  it('syncs a category using master and replica ids', async () => {
    renderWithProviders(<SyncStatusPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('sync-category'));
      expect(JSON.parse(call[1].body)).toEqual({
        sourceId: '192.168.1.1:80',
        destinationId: '10.0.0.2:80',
        category: 'filtering',
      });
    });
  });

  it('asks for a master server when none is set', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection()], masterServerId: null,
    }));

    renderWithProviders(<SyncStatusPage />);

    await waitFor(() => expect(screen.getByText('No master server selected')).toBeInTheDocument());
  });

  it('warns that manual sync is blocked while auto-sync runs', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('auto-sync-config')) {
        return { ok: true, status: 200, json: async () => ({ ...AUTO_SYNC, isRunning: true }) } as unknown as Response;
      }
      return mockFetch()(url, init);
    }) as unknown as typeof fetch;

    renderWithProviders(<SyncStatusPage />);

    await waitFor(() => expect(screen.getByText('Auto-sync is active')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled());
  });

  it('shows the auto-sync history with its filters', async () => {
    renderWithProviders(<SyncStatusPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Auto-sync history/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Auto-sync history/ }));

    await waitFor(() => expect(screen.getByText(/Sync history \(2\)/)).toBeInTheDocument());
    // One of two runs succeeded; the value and its unit are separate elements.
    const tile = screen.getByText('Success rate').closest('.card') as HTMLElement;
    expect(tile).toHaveTextContent('50');
    expect(tile).toHaveTextContent('%');
  });

  it('filters the history by status', async () => {
    renderWithProviders(<SyncStatusPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Auto-sync history/ }));
    await waitFor(() => expect(screen.getByLabelText('Status')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'error' } });

    expect(screen.getByText(/Sync history \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('triggers a manual auto-sync run', async () => {
    renderWithProviders(<SyncStatusPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Auto-sync history/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Trigger sync/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Trigger sync/ }));

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).includes('auto-sync-trigger'))).toBe(true));
  });

  it('reports an unreachable replica', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('auto-sync-config')) {
        return { ok: true, status: 200, json: async () => AUTO_SYNC } as unknown as Response;
      }
      const { connectionId } = JSON.parse(init!.body as string);
      if (connectionId === '10.0.0.2:80') {
        return { ok: false, status: 502, json: async () => ({}) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ settings: MASTER_SETTINGS, errors: {} }) } as unknown as Response;
    }) as unknown as typeof fetch;

    renderWithProviders(<SyncStatusPage />);

    await waitFor(() => expect(screen.getByText('Unreachable')).toBeInTheDocument());
    const card = screen.getByText('Unreachable').closest('div.card') as HTMLElement;
    expect(within(card).getByText(/Failed to fetch settings for 10.0.0.2:80/)).toBeInTheDocument();
  });
});
