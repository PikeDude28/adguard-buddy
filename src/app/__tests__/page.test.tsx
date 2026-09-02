import { render, screen } from '@testing-library/react';
import Home from '../page';
import { useConnections } from '../contexts/ConnectionsContext';
import { mockConnectionsValue, connection } from '../../test-utils';

jest.mock('../contexts/ConnectionsContext', () => ({
  ...jest.requireActual('../contexts/ConnectionsContext'),
  useConnections: jest.fn(),
}));

const mockUseConnections = useConnections as jest.MockedFunction<typeof useConnections>;

describe('Home', () => {
  beforeEach(() => jest.clearAllMocks());

  it('links to every section', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    render(<Home />);

    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([
      '/dashboard', '/query-log', '/statistics', '/sync-status', '/settings',
    ]));
  });

  it('describes what each section is for', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue());
    render(<Home />);

    expect(screen.getByText('Search DNS queries across all servers')).toBeInTheDocument();
    expect(screen.getByText('What drifted from the master, and one-click sync')).toBeInTheDocument();
  });

  it('shows the getting-started steps when nothing is configured', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ connections: [], selectedId: null, selected: null }));
    render(<Home />);

    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.getByText('Add your servers')).toBeInTheDocument();
    expect(screen.getByText('Pick a master')).toBeInTheDocument();
  });

  it('hides the getting-started steps once servers exist', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({
      connections: [connection(), connection({ id: 'b', ip: '10.0.0.2' })],
    }));
    render(<Home />);

    expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
    expect(screen.getByText(/2 servers configured/)).toBeInTheDocument();
  });

  it('does not claim a server count while loading', () => {
    mockUseConnections.mockReturnValue(mockConnectionsValue({ isLoading: true }));
    render(<Home />);

    expect(screen.queryByText(/servers configured/)).not.toBeInTheDocument();
  });
});
