import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBell } from '../NotificationBell';

const withLogs = (logs: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ recentLogs: logs }),
}) as unknown as Response;

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(withLogs([]));
  });

  it('shows no marker when there are no failures', async () => {
    render(<NotificationBell />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('counts recent sync errors in its label', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(withLogs([
      { status: 'success', category: 'filtering', replicaId: 'a', message: 'ok' },
      { status: 'error', category: 'rewrites', replicaId: '10.0.0.2:80', message: 'boom' },
    ]));

    render(<NotificationBell />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications (1 sync errors)' })).toBeInTheDocument());
  });

  it('lists the failures when opened', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(withLogs([
      { status: 'error', category: 'rewrites', replicaId: '10.0.0.2:80', message: 'boom' },
    ]));

    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByRole('button', { name: /sync errors/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /sync errors/ }));

    expect(screen.getByText('rewrites → 10.0.0.2:80')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open sync history' })).toHaveAttribute('href', '/sync-status');
  });

  it('says so when there is nothing wrong', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText('No recent sync errors.')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Auto-sync')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Auto-sync')).not.toBeInTheDocument();
  });

  it('stays quiet when the status endpoint fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    render(<NotificationBell />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
