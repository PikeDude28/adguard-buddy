import React, { useId } from 'react';

type FieldProps = {
  label: string;
  hint?: string;
  /** Renders the label for screen readers only. */
  hideLabel?: boolean;
  className?: string;
  children: (id: string) => React.ReactNode;
};

/**
 * Label + control pairing with a generated id, so every input in the app has a
 * real accessible name instead of relying on a placeholder.
 */
export function Field({ label, hint, hideLabel = false, className = '', children }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]'
        }
      >
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">{hint}</p>}
    </div>
  );
}

export function Checkbox({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 flex-shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-[var(--text)]">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] text-[var(--text-subtle)]">{description}</span>}
      </span>
    </label>
  );
}
