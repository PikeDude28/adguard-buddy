import React from 'react';

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

/**
 * Page titles sit one step below the headline figures on the page, so a KPI
 * value is what the eye lands on first.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-[var(--text-subtle)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Alert({
  tone = 'danger', title, children,
}: {
  tone?: 'danger' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    danger: { background: 'var(--danger-soft)', borderColor: 'var(--danger-border)', color: 'var(--danger)' },
    warning: { background: 'var(--warning-soft)', borderColor: 'var(--warning-border)', color: 'var(--warning)' },
    info: { background: 'var(--info-soft)', borderColor: 'var(--info-border)', color: 'var(--info)' },
  }[tone];

  return (
    <div className="mb-5 rounded-[var(--radius)] border px-4 py-3 text-[13px]" style={styles} role="alert">
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-0.5 text-[var(--text-muted)]' : ''}>{children}</div>
    </div>
  );
}
