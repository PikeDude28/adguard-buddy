import { screen, waitFor, fireEvent } from '@testing-library/react';
import StatisticsPage from '../page';
import { useConnections } from '../../contexts/ConnectionsContext';
import { connection, mockConnectionsValue, renderWithProviders } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const STATS = {
  num_dns_queries: 10000,
  num_blocked_filtering: 2500,
  num_replaced_safebrowsing: 30,
  num_replaced_parental: 12,
  avg_processing_time: 0.0123,
  time_units: 'hours',
  dns_queries: [100, 200, 300],
  blocked_filtering: [10, 20, 30],
  top_clients: [{ 'iphone.lan': 500 }, { 'desktop.lan': 300 }],
  top_blocked_domains: [{ 'ads.example': 200 }],
  top_queried_domains: [{ 'cdn.example': 900 }],
  top_upstreams_avg_time: [{ '1.1.1.1': 0.015 }],
};

const jsonResponse = (json: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => json }) as unknown as Response;

describe('StatisticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(STATS));
  });

  it('requests single-server stats by connection id', async () => {
    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/statistics', expect.anything()));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ connectionId: '192.168.1.1:80' });
  });

  it('uses the combined endpoint in combined scope', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      mode: 'combined',
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
    }));

    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/statistics/combined'));
  });

  it('renders the headline figures', async () => {
    renderWithProviders(<StatisticsPage />);

    // The total also appears in the donut centre, hence getAllByText.
    await waitFor(() => expect(screen.getAllByText('10,000').length).toBeGreaterThan(0));
    expect(screen.getAllByText('2,500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0);
    expect(screen.getByText('42')).toBeInTheDocument();  // threats
    expect(screen.getByText('12.3')).toBeInTheDocument(); // avg ms
  });

  it('draws the time series with an accessible label', async () => {
    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(screen.getByLabelText(/Allowed and Blocked per hour/)).toBeInTheDocument());
  });

  it('shows an empty state instead of inventing a time series', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({
      ...STATS, dns_queries: undefined, blocked_filtering: undefined,
    }));

    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(screen.getByText('No time series available')).toBeInTheDocument());
    expect(screen.queryByLabelText(/per hour/)).not.toBeInTheDocument();
  });

  it('lists top clients and domains', async () => {
    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(screen.getByText('iphone.lan')).toBeInTheDocument());
    expect(screen.getByText('ads.example')).toBeInTheDocument();
    expect(screen.getByText('cdn.example')).toBeInTheDocument();
  });

  it('formats upstream times in milliseconds', async () => {
    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(screen.getByText('15 ms')).toBeInTheDocument());
  });

  it('loads threat domains on demand only', async () => {
    renderWithProviders(<StatisticsPage />);
    await waitFor(() => expect(screen.getByText('Show domains')).toBeInTheDocument());

    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes('query-log')))
      .toBe(false);

    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({
      data: [{ question: { name: 'malware.test' }, time: '2026-01-01T00:00:00Z' }],
    }));
    fireEvent.click(screen.getByText('Show domains'));

    await waitFor(() => expect(screen.getByText('malware.test')).toBeInTheDocument());
  });

  it('surfaces a fetch error', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: 'Server unreachable' }, false, 502));

    renderWithProviders(<StatisticsPage />);

    await waitFor(() => expect(screen.getByText('Server unreachable')).toBeInTheDocument());
  });

  it('shows an empty state when no connections exist', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [], selectedId: null, selected: null,
    }));

    renderWithProviders(<StatisticsPage />);

    expect(screen.getByText('No connections configured')).toBeInTheDocument();
  });
});
