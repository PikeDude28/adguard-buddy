import { render, screen, fireEvent } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';

describe('SiteFooter', () => {
  it('shows the current year', () => {
    render(<SiteFooter />);
    expect(screen.getByText(`© ${new Date().getFullYear()} chrizzo84`)).toBeInTheDocument();
  });

  it('links to the profile and the repository in a new tab', () => {
    render(<SiteFooter />);

    const profile = screen.getByLabelText('GitHub Profile chrizzo84');
    const repo = screen.getByLabelText('Repository adguard-buddy');

    expect(profile).toHaveAttribute('href', 'https://github.com/chrizzo84');
    expect(repo).toHaveAttribute('href', 'https://github.com/chrizzo84/adguard-buddy');
    [profile, repo].forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('renders the app version', () => {
    render(<SiteFooter />);
    expect(screen.getByText(/^v/)).toBeInTheDocument();
  });

  it('dispatches the open-news event when What\'s New is clicked', () => {
    const listener = jest.fn();
    window.addEventListener('adguard-buddy:open-news', listener);

    render(<SiteFooter />);
    fireEvent.click(screen.getByLabelText("Open What's New"));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('adguard-buddy:open-news', listener);
  });
});
