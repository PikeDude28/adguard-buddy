import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import {
  ConnectionsProvider, connectionLabel, useConnections,
} from '../ConnectionsContext';

const CONNECTIONS = [
  { id: '192.168.1.1:80', ip: '192.168.1.1', port: 80, username: 'admin' },
  { id: 'https://dns.test', url: 'https://dns.test', username: 'admin' },
];

function Probe() {
  const { connections, mode, selectedId, selected, scopedConnections, setMode, setSelectedId, isLoading, error } =
    useConnections();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? 'none'}</span>
      <span data-testid="count">{connections.length}</span>
      <span data-testid="mode">{mode}</span>
      <span data-testid="selected">{selectedId ?? 'none'}</span>
      <span data-testid="selected-user">{selected?.username ?? 'none'}</span>
      <span data-testid="scoped">{scopedConnections.map(c => c.id).join(',')}</span>
      <button type="button" onClick={() => setMode('combined')}>combined</button>
      <button type="button" onClick={() => setSelectedId('https://dns.test')}>pick second</button>
    </div>
  );
}

const renderProvider = () => render(<ConnectionsProvider><Probe /></ConnectionsProvider>);

describe('ConnectionsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ connections: CONNECTIONS, masterServerIp: '192.168.1.1:80' }),
    } as unknown as Response);
  });

  it('loads connections and selects the first by default', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByTestId('selected')).toHaveTextContent('192.168.1.1:80');
    expect(screen.getByTestId('selected-user')).toHaveTextContent('admin');
  });

  it('scopes to one server in single mode and all in combined', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('scoped')).toHaveTextContent('192.168.1.1:80');

    act(() => { fireEvent.click(screen.getByText('combined')); });

    expect(screen.getByTestId('mode')).toHaveTextContent('combined');
    expect(screen.getByTestId('scoped')).toHaveTextContent('192.168.1.1:80,https://dns.test');
  });

  it('persists the scope across mounts', async () => {
    const { unmount } = renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    act(() => {
      fireEvent.click(screen.getByText('combined'));
      fireEvent.click(screen.getByText('pick second'));
    });
    unmount();

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('mode')).toHaveTextContent('combined');
    expect(screen.getByTestId('selected')).toHaveTextContent('https://dns.test');
  });

  it('falls back to the first server when the stored selection is gone', async () => {
    localStorage.setItem('adguard-buddy-scope-server', 'deleted.example');

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('192.168.1.1:80'));
  });

  it('downgrades combined mode when fewer than two servers exist', async () => {
    localStorage.setItem('adguard-buddy-scope-mode', 'combined');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ connections: [CONNECTIONS[0]], masterServerIp: null }),
    } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('mode')).toHaveTextContent('single');
  });

  it('exposes a fetch failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch connections.'));
  });

  it('handles an empty store', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ connections: [], masterServerIp: null }),
    } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(screen.getByTestId('scoped')).toHaveTextContent('');
  });

  it('throws when used outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useConnections must be used within a ConnectionsProvider');
    spy.mockRestore();
  });
});

describe('connectionLabel', () => {
  it('shows the host for a URL connection', () => {
    expect(connectionLabel({ url: 'https://dns.test:8443/path' })).toBe('dns.test:8443');
  });

  it('falls back to the raw value for an unparsable URL', () => {
    expect(connectionLabel({ url: 'not a url' })).toBe('not a url');
  });

  it('shows ip:port for an ip connection', () => {
    expect(connectionLabel({ ip: '10.0.0.1', port: 3000 })).toBe('10.0.0.1:3000');
  });

  it('omits the port when there is none', () => {
    expect(connectionLabel({ ip: '10.0.0.1' })).toBe('10.0.0.1');
  });

  it('reports unknown when there is nothing to show', () => {
    expect(connectionLabel({})).toBe('unknown');
  });
});
