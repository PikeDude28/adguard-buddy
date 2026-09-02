import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
};

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] border border-transparent',
  secondary:
    'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]',
  ghost:
    'bg-transparent text-[var(--text-muted)] border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  danger:
    'bg-transparent text-[var(--danger)] border border-[var(--danger-border)] hover:bg-[var(--danger-soft)]',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-[var(--radius)] font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-45
        ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<ButtonProps, 'children' | 'icon'> & {
  icon: React.ReactNode;
  /** Required: icon-only controls need an accessible name. */
  label: string;
};

export function IconButton({ icon, label, variant = 'ghost', className = '', ...rest }: IconButtonProps) {
  return (
    <Button
      variant={variant}
      aria-label={label}
      title={label}
      className={`h-8 w-8 !px-0 ${className}`}
      {...rest}
    >
      {icon}
    </Button>
  );
}
