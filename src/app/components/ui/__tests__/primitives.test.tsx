import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from '../Badge';
import { Button, IconButton } from '../Button';
import { Card, CardHeader } from '../Card';
import { EmptyState } from '../EmptyState';
import { Field, Checkbox } from '../Field';
import { Segmented } from '../Segmented';
import { StatTile } from '../StatTile';
import { Alert, PageHeader } from '../PageHeader';
import { LogConsole } from '../LogConsole';

describe('Badge', () => {
  it('renders its label and an optional live dot', () => {
    const { container } = render(<Badge tone="success" dot pulse>Connected</Badge>);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(container.querySelector('.live-dot')).toBeInTheDocument();
  });

  it('omits the dot by default', () => {
    const { container } = render(<Badge>Neutral</Badge>);
    expect(container.querySelector('.live-dot')).toBeNull();
  });
});

describe('Button', () => {
  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled and non-interactive while loading', () => {
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Go</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('gives icon-only buttons an accessible name', () => {
    render(<IconButton icon={<span>x</span>} label="Delete server" onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete server' })).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders a heading, description and actions', () => {
    render(
      <Card>
        <CardHeader title="Servers" description="All instances" actions={<button type="button">Refresh</button>} />
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Servers' })).toBeInTheDocument();
    expect(screen.getByText('All instances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('drops its padding when flush', () => {
    const { container } = render(<Card flush>content</Card>);
    expect(container.firstElementChild).not.toHaveClass('p-5');
  });
});

describe('EmptyState', () => {
  it('renders a title, description and action', () => {
    render(<EmptyState title="Nothing here" description="Add one" action={<button type="button">Add</button>} />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links its label to the control', () => {
    render(<Field label="Username">{id => <input id={id} />}</Field>);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('can hide the label visually while keeping it accessible', () => {
    render(<Field label="Search" hideLabel>{id => <input id={id} />}</Field>);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('shows a hint', () => {
    render(<Field label="Port" hint="1-65535">{id => <input id={id} />}</Field>);
    expect(screen.getByText('1-65535')).toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  it('reports the new checked state', () => {
    const onChange = jest.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Enable" />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('marks the control disabled so the browser blocks interaction', () => {
    render(<Checkbox checked={false} onChange={jest.fn()} label="Enable" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma', disabled: true },
  ];

  it('marks the active option for assistive technology', () => {
    render(<Segmented label="Mode" value="a" onChange={jest.fn()} options={options} />);

    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false');
  });

  it('reports a selection', () => {
    const onChange = jest.fn();
    render(<Segmented label="Mode" value="a" onChange={onChange} options={options} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('ignores a disabled option', () => {
    const onChange = jest.fn();
    render(<Segmented label="Mode" value="a" onChange={onChange} options={options} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StatTile', () => {
  it('renders label, value, unit and hint', () => {
    render(<StatTile label="Queries" value="1,234" unit="ms" hint="25%" />);

    expect(screen.getByText('Queries')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('ms')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});

describe('PageHeader and Alert', () => {
  it('renders the page title as the only h1-level heading', () => {
    render(<PageHeader title="Dashboard" description="Live status" actions={<button type="button">R</button>} />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Live status')).toBeInTheDocument();
  });

  it('exposes alerts to assistive technology', () => {
    render(<Alert tone="warning" title="Careful">Something drifted</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Careful');
    expect(screen.getByRole('alert')).toHaveTextContent('Something drifted');
  });
});

describe('LogConsole', () => {
  it('renders each line', () => {
    render(<LogConsole lines={['Starting', 'Successfully applied']} running={false} />);

    expect(screen.getByText(/Starting/)).toBeInTheDocument();
    expect(screen.getByText(/Successfully applied/)).toBeInTheDocument();
  });

  it('shows a waiting indicator while the stream is open', () => {
    render(<LogConsole lines={['Starting']} running />);
    expect(screen.getByText('Waiting for output…')).toBeInTheDocument();
  });

  it('hides the indicator once finished', () => {
    render(<LogConsole lines={['Done.']} running={false} />);
    expect(screen.queryByText('Waiting for output…')).not.toBeInTheDocument();
  });
});
