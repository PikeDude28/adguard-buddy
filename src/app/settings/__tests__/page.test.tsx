import { screen, waitFor, fireEvent } from '@testing-library/react';
import Settings from '../page';
import { useConnections } from '../../contexts/ConnectionsContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { connection, mockConnectionsValue, renderWithProviders } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const AUTO_SYNC = {
  config: { enabled: false, interval: 'disabled', categories: [] },
  nextSync: null,
  isPaused: false,
  recentLogs: [],
};

function mockFetch() {
  return jest.fn(async (url: string) => {
    if (String(url).includes('auto-sync-config')) {
      return { ok: true, status: 200, json: async () => AUTO_SYNC } as unknown as Response;
    }
    if (String(url).includes('check-adguard')) {
      return { ok: true, status: 200, json: async () => ({ status: 'connected' }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({ message: 'ok' }) } as unknown as Response;
  });
}

const render = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [], selectedId: null, selected: null }));
    global.fetch = mockFetch() as unknown as typeof fetch;
  });

  it('sends a new connection with a plaintext password for the server to encrypt', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText('IP or URL'), { target: { value: '10.0.0.5' } });
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '3000' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('save-connections'));
      expect(JSON.parse(call[1].body).connections[0]).toEqual({
        ip: '10.0.0.5',
        url: undefined,
        port: 3000,
        username: 'admin',
        allowInsecure: false,
        password: 'hunter2',
      });
    });
  });

  it('requires a password for a new connection', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText('IP or URL'), { target: { value: '10.0.0.5' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }));

    await waitFor(() =>
      expect(screen.getByText('A password is required for new connections.')).toBeInTheDocument());
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).includes('save-connections'))).toBe(false);
  });

  it('derives the port from a URL target', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByLabelText('IP or URL'), { target: { value: 'https://adguard.local' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('save-connections'));
      const saved = JSON.parse(call[1].body).connections[0];
      expect(saved).toMatchObject({ url: 'https://adguard.local', port: 443 });
      expect(saved.ip).toBeUndefined();
    });
  });

  it('omits the password when editing without entering a new one', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [connection()] }));
    render(<Settings />);

    fireEvent.click(screen.getByLabelText('Edit 192.168.1.1:80'));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newadmin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update connection' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('save-connections'));
      const saved = JSON.parse(call[1].body).connections[0];
      expect(saved.username).toBe('newadmin');
      expect(saved).not.toHaveProperty('password');
    });
  });

  it('lists saved connections and marks the master', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection(), connection({ id: '10.0.0.2:80', ip: '10.0.0.2' })],
      masterServerId: '192.168.1.1:80',
    }));
    render(<Settings />);

    expect(screen.getByText('Master')).toBeInTheDocument();
    expect(screen.getByLabelText('Current master server')).toBeDisabled();
    expect(screen.getByLabelText('Set 10.0.0.2:80 as master')).toBeEnabled();
  });

  it('tests a connection by id', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [connection()] }));
    render(<Settings />);

    fireEvent.click(screen.getByLabelText('Test connection to 192.168.1.1:80'));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('check-adguard'));
      expect(JSON.parse(call[1].body)).toEqual({ connectionId: '192.168.1.1:80' });
    });
  });

  it('asks for confirmation before deleting', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [connection()] }));
    render(<Settings />);

    fireEvent.click(screen.getByLabelText('Delete 192.168.1.1:80'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
      String(url).includes('save-connections'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('save-connections'));
      expect(JSON.parse(call[1].body).connections).toEqual([]);
    });
  });

  it('clears the master when the master itself is deleted', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection()], masterServerId: '192.168.1.1:80',
    }));
    render(<Settings />);

    fireEvent.click(screen.getByLabelText('Delete 192.168.1.1:80'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('save-connections'));
      expect(JSON.parse(call[1].body).masterServerIp).toBeNull();
    });
  });

  it('warns that auto-sync needs a master server', async () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [connection()], masterServerId: null }));
    render(<Settings />);

    expect(screen.getByText('No master server selected')).toBeInTheDocument();
  });

  it('enables auto-sync through the API', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Enable automatic sync/ }));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls
        .find(([url, init]) => String(url).includes('auto-sync-config') && init?.method === 'POST');
      expect(JSON.parse(call[1].body)).toEqual({ enabled: true });
    });
  });

  it('offers every accent theme', () => {
    render(<Settings />);

    ['green', 'blue', 'purple', 'orange'].forEach(name => {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    });
  });

  it('applies a chosen theme to the body', () => {
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /purple/i }));

    expect(document.body.classList.contains('theme-purple')).toBe(true);
  });
});
