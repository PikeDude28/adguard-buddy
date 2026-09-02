import { render, screen, fireEvent } from '@testing-library/react';
import PageControls, { type QueryLogOptions } from '../PageControls';

const OPTIONS: QueryLogOptions = {
  refreshInterval: 5000,
  perServerLimit: 100,
  concurrency: 5,
  combinedMax: 500,
  pageSize: 50,
};

describe('PageControls', () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders the always-available options', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined={false} />);

    expect(screen.getByLabelText('Auto refresh')).toHaveValue('5000');
    expect(screen.getByLabelText('Rows per server')).toHaveValue('100');
    expect(screen.getByLabelText('Page size')).toHaveValue('50');
  });

  it('does not offer server selection - that lives in the global scope picker', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined={false} />);

    expect(screen.queryByLabelText(/Server/)).not.toBeInTheDocument();
    expect(screen.queryByText('Single')).not.toBeInTheDocument();
  });

  it('hides the multi-server options in single scope', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined={false} />);

    expect(screen.queryByLabelText('Concurrency')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Max total rows')).not.toBeInTheDocument();
  });

  it('shows the multi-server options in combined scope', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined />);

    expect(screen.getByLabelText('Concurrency')).toHaveValue('5');
    expect(screen.getByLabelText('Max total rows')).toHaveValue('500');
  });

  it.each([
    ['Auto refresh', '10000', { refreshInterval: 10000 }],
    ['Rows per server', '200', { perServerLimit: 200 }],
    ['Page size', '25', { pageSize: 25 }],
  ])('reports a change to %s as a numeric patch', (label, value, expected) => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined={false} />);

    fireEvent.change(screen.getByLabelText(label), { target: { value } });

    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('reports combined-only changes', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined />);

    fireEvent.change(screen.getByLabelText('Concurrency'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith({ concurrency: 10 });

    fireEvent.change(screen.getByLabelText('Max total rows'), { target: { value: '1000' } });
    expect(onChange).toHaveBeenCalledWith({ combinedMax: 1000 });
  });

  it('offers turning auto refresh off', () => {
    render(<PageControls options={OPTIONS} onChange={onChange} combined={false} />);

    fireEvent.change(screen.getByLabelText('Auto refresh'), { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith({ refreshInterval: 0 });
  });
});
