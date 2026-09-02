import { render, screen, fireEvent } from '@testing-library/react';
import NewsPopup from '../NewsPopup';

const MARKDOWN = '# Release 1.0\n\nSomething **new** happened.';

describe('NewsPopup', () => {
  const onClose = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    const { container } = render(<NewsPopup isOpen={false} onClose={onClose} content={MARKDOWN} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the parsed markdown in preview mode by default', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);

    const preview = screen.getByTestId('news-preview-content');
    expect(preview.querySelector('h1')?.textContent).toBe('Release 1.0');
    expect(preview.querySelector('strong')?.textContent).toBe('new');
    expect(screen.queryByTestId('news-raw-content')).not.toBeInTheDocument();
  });

  it('switches between raw and preview', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));
    expect(screen.getByTestId('news-raw-content')).toHaveTextContent('# Release 1.0');
    expect(screen.queryByTestId('news-preview-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('news-preview-content')).toBeInTheDocument();
  });

  it('marks the active mode for assistive technology', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);

    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Raw' })).toHaveAttribute('aria-selected', 'false');
  });

  it('sanitizes script tags out of the preview', () => {
    render(<NewsPopup isOpen onClose={onClose} content={'<script>alert(1)</script>\n\nSafe text'} />);

    const preview = screen.getByTestId('news-preview-content');
    expect(preview.querySelector('script')).toBeNull();
    expect(preview).toHaveTextContent('Safe text');
  });

  it('closes via the close button', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);
    fireEvent.click(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders as a modal dialog', () => {
    render(<NewsPopup isOpen onClose={onClose} content={MARKDOWN} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('handles empty content', () => {
    render(<NewsPopup isOpen onClose={onClose} content="" />);
    expect(screen.getByTestId('news-preview-content')).toBeEmptyDOMElement();
  });
});
