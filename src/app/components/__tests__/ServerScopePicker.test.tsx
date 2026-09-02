import { render, screen, fireEvent } from '@testing-library/react';
import { ServerScopePicker } from '../ServerScopePicker';
import { useConnections } from '../../contexts/ConnectionsContext';
import { connection, mockConnectionsValue } from '../../../test-utils';

jest.mock('../../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

const TWO = [connection(), connection({ id: 'https://dns.test', url: 'https://dns.test', ip: undefined, port: undefined })];

describe('ServerScopePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing while connections are loading', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ isLoading: true }));
    const { container } = render(<ServerScopePicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no servers are configured', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [], selectedId: null, selected: null }));
    const { container } = render(<ServerScopePicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the scope toggle for a single server', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    render(<ServerScopePicker />);

    expect(screen.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected server')).toBeInTheDocument();
  });

  it('offers single and combined scope for several servers', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: TWO }));
    render(<ServerScopePicker />);

    expect(screen.getByRole('tab', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
  });

  it('reports a scope change', () => {
    const setMode = jest.fn();
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: TWO, setMode }));
    render(<ServerScopePicker />);

    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(setMode).toHaveBeenCalledWith('combined');
  });

  it('reports a server change and labels servers by host', () => {
    const setSelectedId = jest.fn();
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: TWO, setSelectedId }));
    render(<ServerScopePicker />);

    expect(screen.getByRole('option', { name: 'dns.test' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Selected server'), { target: { value: 'https://dns.test' } });
    expect(setSelectedId).toHaveBeenCalledWith('https://dns.test');
  });

  it('hides the server dropdown in combined scope', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: TWO, mode: 'combined' }));
    render(<ServerScopePicker />);

    expect(screen.queryByLabelText('Selected server')).not.toBeInTheDocument();
  });
});
