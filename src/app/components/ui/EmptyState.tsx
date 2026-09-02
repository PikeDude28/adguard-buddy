import React from 'react';

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `inline` fits inside a card section; `block` fills a full page area. */
  size?: 'inline' | 'block';
};

export function EmptyState({ icon, title, description, action, size = 'block' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${size === 'block' ? 'py-14' : 'py-8'}`}>
      {icon && (
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-[var(--text-subtle)]"
          style={{ background: 'var(--surface-2)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-[var(--text-subtle)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
