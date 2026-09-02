import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

function Harness() {
  const { notify } = useToast();
  return (
    <>
      <button type="button" onClick={() => notify('Saved', 'success')}>success</button>
      <button type="button" onClick={() => notify('Broke', 'error')}>error</button>
      <button type="button" onClick={() => notify('Sticky', 'info', 0)}>sticky</button>
    </>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows a toast and dismisses it after the timeout', () => {
    render(<ToastProvider><Harness /></ToastProvider>);

    act(() => { fireEvent.click(screen.getByText('success')); });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('stacks several toasts', () => {
    render(<ToastProvider><Harness /></ToastProvider>);

    act(() => {
      fireEvent.click(screen.getByText('success'));
      fireEvent.click(screen.getByText('error'));
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Broke')).toBeInTheDocument();
  });

  it('keeps a toast with no duration until dismissed', () => {
    render(<ToastProvider><Harness /></ToastProvider>);

    act(() => { fireEvent.click(screen.getByText('sticky')); });
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByText('Sticky')).toBeInTheDocument();

    act(() => { fireEvent.click(screen.getByLabelText('Dismiss notification')); });
    expect(screen.queryByText('Sticky')).not.toBeInTheDocument();
  });

  it('announces toasts politely', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('throws when used outside the provider', () => {
    const Bare = () => { useToast(); return null; };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Bare />)).toThrow('useToast must be used within a ToastProvider');

    spy.mockRestore();
  });
});
