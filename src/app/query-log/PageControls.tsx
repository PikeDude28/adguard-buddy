"use client";

import React from 'react';
import { Field } from '../components/ui/Field';

export type QueryLogOptions = {
  refreshInterval: number;
  perServerLimit: number;
  concurrency: number;
  combinedMax: number;
  pageSize: number;
};

type Props = {
  options: QueryLogOptions;
  onChange: (patch: Partial<QueryLogOptions>) => void;
  /** Concurrency and the combined cap only apply when several servers are queried. */
  combined: boolean;
};

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '2 seconds', value: 2000 },
  { label: '5 seconds', value: 5000 },
  { label: '10 seconds', value: 10000 },
  { label: '30 seconds', value: 30000 },
];

/**
 * Fetch tuning for the query log. Server selection lives in the global scope
 * picker in the top bar, so it is deliberately absent here.
 */
const PageControls = React.memo(function PageControls({ options, onChange, combined }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Field label="Auto refresh">
        {id => (
          <select
            id={id}
            value={options.refreshInterval}
            onChange={e => onChange({ refreshInterval: Number(e.target.value) })}
          >
            {REFRESH_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Rows per server">
        {id => (
          <select
            id={id}
            value={options.perServerLimit}
            onChange={e => onChange({ perServerLimit: Number(e.target.value) })}
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </Field>

      <Field label="Page size">
        {id => (
          <select
            id={id}
            value={options.pageSize}
            onChange={e => onChange({ pageSize: Number(e.target.value) })}
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </Field>

      {combined && (
        <>
          <Field label="Concurrency" hint="Parallel server requests">
            {id => (
              <select
                id={id}
                value={options.concurrency}
                onChange={e => onChange({ concurrency: Number(e.target.value) })}
              >
                {[1, 2, 3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </Field>

          <Field label="Max total rows">
            {id => (
              <select
                id={id}
                value={options.combinedMax}
                onChange={e => onChange({ combinedMax: Number(e.target.value) })}
              >
                {[100, 250, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </Field>
        </>
      )}
    </div>
  );
});

export default PageControls;
