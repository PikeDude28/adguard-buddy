import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { MobileNav, NAV_ITEMS, Sidebar } from '../Sidebar';

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('renders every navigation entry', () => {
    render(<Sidebar collapsed={false} onToggleCollapsed={jest.fn()} />);

    NAV_ITEMS.forEach(item => {
      expect(screen.getByRole('link', { name: item.name })).toHaveAttribute('href', item.href);
    });
  });

  it('marks the current route', () => {
    render(<Sidebar collapsed={false} onToggleCollapsed={jest.fn()} />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('hides the labels when collapsed but keeps the links reachable', () => {
    render(<Sidebar collapsed onToggleCollapsed={jest.fn()} />);

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByTitle('Dashboard')).toHaveAttribute('href', '/dashboard');
  });

  it('reports the collapse toggle', () => {
    const onToggle = jest.fn();
    render(<Sidebar collapsed={false} onToggleCollapsed={onToggle} />);

    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('labels the toggle by what it will do', () => {
    const { rerender } = render(<Sidebar collapsed={false} onToggleCollapsed={jest.fn()} />);
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();

    rerender(<Sidebar collapsed onToggleCollapsed={jest.fn()} />);
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
  });
});

describe('MobileNav', () => {
  it('renders the same destinations and marks the current one', () => {
    mockUsePathname.mockReturnValue('/query-log');
    render(<MobileNav />);

    expect(screen.getAllByRole('link')).toHaveLength(NAV_ITEMS.length);
    expect(screen.getByRole('link', { name: 'Query Log' })).toHaveAttribute('aria-current', 'page');
  });
});
