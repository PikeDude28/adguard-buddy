import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import QueryLogPage from '../page';
import { useConnections } from '../../contexts/ConnectionsContext';
import { connection, mockConnectionsValue, renderWithProviders } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const LOGS = [
  {
    question: { name: 'ads.example' },
    client: '192.168.1.50',
    time: '2026-01-01T10:00:00Z',
    reason: 'FilteredBlackList',
  },
  {
    question: { name: 'cdn.example' },
    client: '192.168.1.51',
    time: '2026-01-01T09:00:00Z',
    reason: 'NotFilteredNotFound',
  },
];

const jsonResponse = (json: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => json, text: async () => JSON.stringify(json) }) as unknown as Response;

describe('QueryLogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ data: LOGS }));
  });

  afterEach(() => jest.useRealTimers());

  it('fetches by connection id without credentials', async () => {
    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.connectionId).toBe('192.168.1.1:80');
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('username');
  });

  it('renders the log rows with readable statuses', async () => {
    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());
    // Scoped to the table: "Processed" is also a filter tab label.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Blocked')).toBeInTheDocument();
    expect(within(table).getByText('Processed')).toBeInTheDocument();
  });

  it('hides the server column in single scope', async () => {
    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());
    expect(screen.queryByRole('columnheader', { name: 'Server' })).not.toBeInTheDocument();
  });

  it('shows the server column and queries every server in combined scope', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      mode: 'combined',
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));

    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Server' })).toBeInTheDocument());
    const logCalls = (global.fetch as jest.Mock).mock.calls
      .filter(([url]) => String(url).includes('/api/query-log'));
    expect(logCalls).toHaveLength(2);
  });

  it('filters rows by the search term', async () => {
    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Search queries'), { target: { value: 'cdn' } });

    expect(screen.queryByText('ads.example')).not.toBeInTheDocument();
    expect(screen.getByText('cdn.example')).toBeInTheDocument();
  });

  it('sends the selected status filter to the API', async () => {
    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Filtered' }));

    await waitFor(() => {
      const last = (global.fetch as jest.Mock).mock.calls.at(-1);
      expect(JSON.parse(last[1].body).response_status).toBe('filtered');
    });
  });

  it('confirms before writing a rule and says it affects every server', async () => {
    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Unblock/ })[0]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/all 1 configured server/)).toBeInTheDocument();

    // Nothing is written until the user confirms.
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).includes('set-filtering-rule'))).toBe(false);
  });

  it('cancelling the confirmation writes nothing', async () => {
    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Block/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).includes('set-filtering-rule'))).toBe(false);
  });

  it('posts the rule with every connection id after confirming', async () => {
    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
      json: async () => ({}),
    } as unknown as Response);

    fireEvent.click(screen.getAllByRole('button', { name: /Unblock/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Unblock everywhere/ }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls
        .find(([url]) => String(url).includes('set-filtering-rule'));
      expect(JSON.parse(call[1].body)).toEqual({
        domain: 'ads.example',
        action: 'unblock',
        connectionIds: ['192.168.1.1:80'],
      });
    });
  });

  it('shows an empty state when there are no logs', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(screen.getByText('No queries logged')).toBeInTheDocument());
  });

  it('reports a failed fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: 'Upstream error' }, false, 502));

    renderWithProviders(<QueryLogPage />);

    await waitFor(() => expect(screen.getByText(/Upstream error/)).toBeInTheDocument());
  });

  it('offers server colours only where the server column is shown', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));

    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByText('ads.example')).toBeInTheDocument());

    expect(screen.queryByLabelText('Colour for 192.168.1.1:80')).not.toBeInTheDocument();
  });

  it('persists a server colour against the connection id', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      mode: 'combined',
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));

    renderWithProviders(<QueryLogPage />);
    await waitFor(() => expect(screen.getByLabelText('Colour for 192.168.1.1:80')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Colour for 192.168.1.1:80'), { target: { value: '#ff0000' } });

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls
        .find(([url]) => String(url).includes('save-connections'));
      const saved = JSON.parse(call[1].body).connections;
      // The colour lands on the right record even though the id is ip:port.
      expect(saved[0]).toMatchObject({ ip: '192.168.1.1', port: 80, color: '#ff0000' });
      expect(saved[1].color).toBeUndefined();
    });
  });
});
