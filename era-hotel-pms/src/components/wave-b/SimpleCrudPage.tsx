'use client';

import { useCallback, useEffect, useState } from 'react';
import { EraDataGrid, PageHeader, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { StatusMessage } from '@/components/layout/AppShell';

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T extends Record<string, unknown>> = {
  title: string;
  apiPath: string;
  columns: Column<T>[];
  canWrite?: boolean;
  onAdd?: () => void | Promise<void>;
};

export function SimpleCrudPage<T extends Record<string, unknown>>({
  title,
  apiPath,
  columns,
  canWrite,
  onAdd,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiPath);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? 'Load failed');
      return;
    }
    setRows(Array.isArray(data) ? data : data.items ?? data.inHouse ?? []);
  }, [apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell maxWidthClass="max-w-[1400px]">
      <PageHeader
        title={title}
        actions={
          canWrite && onAdd ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void onAdd()}>
              +
            </button>
          ) : undefined
        }
      />
      <StatusMessage>{msg}</StatusMessage>
      <EraDataGrid<T>
        columns={columns.map((c) => ({
          key: String(c.key),
          header: c.header,
          render: c.render ? (row: T) => c.render!(row) : undefined,
        }))}
        rows={rows}
        rowKey={(r) => String(r.id ?? JSON.stringify(r))}
      />
    </AppShell>
  );
}
