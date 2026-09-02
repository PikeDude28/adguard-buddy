import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Removes the default padding so the card can hold a flush table or list. */
  flush?: boolean;
};

export function Card({ flush = false, className = '', children, ...rest }: CardProps) {
  return (
    <div className={`card ${flush ? '' : 'p-5'} ${className}`} {...rest}>
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned controls: buttons, counts, a legend. */
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function CardHeader({ title, description, actions, icon, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)] leading-tight">
          {icon && <span className="text-[var(--text-subtle)]">{icon}</span>}
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] text-[var(--text-subtle)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled block inside a card - one step down in the surface scale. */
export function Panel({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`panel p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}
