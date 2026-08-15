const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function writeUtf8(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = content.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, data.endsWith('\n') ? data : data + '\n', 'utf8');
  const b = fs.readFileSync(p);
  if (b.length > 1 && b[1] === 0) throw new Error('UTF-16: ' + p);
  console.log('ok', rel);
}

writeUtf8(
  'app/guests/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraDataGrid,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import GuestCardModal from '@/components/GuestCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { matchesCodeNameQuery } from '@/lib/list-filter';

type GuestRow = {
  id: string;
  fullName: string;
  nationality: string;
  phone: string | null;
  globalPersonId: string | null;
};

export default function GuestsPage() {
  const { can } = useAuth();
  const t = useTranslations('guestsPage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardGuestId, setCardGuestId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/guests');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesCodeNameQuery(r, searchApplied)),
    [rows, searchApplied],
  );

  function openCreate() {
    setCardGuestId(null);
    setCardOpen(true);
  }

  function openEdit(guest: GuestRow) {
    setCardGuestId(guest.id);
    setCardOpen(true);
  }

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft('');
          setSearchApplied('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
      </EraListFilterBar>
      <EraDataGrid<GuestRow & Record<string, unknown>>
        columns={[
          { key: 'name', header: t('name'), render: (r) => r.fullName },
          { key: 'nationality', header: t('nationality'), render: (r) => r.nationality },
          { key: 'phone', header: t('phone'), render: (r) => r.phone ?? '—' },
          {
            key: 'mdm',
            header: t('mdmLink'),
            render: (r) =>
              r.globalPersonId ? (
                <span className="text-emerald-700">{t('mdmLinked')}</span>
              ) : (
                <span className="text-[#7F8C8D]">—</span>
              ),
          },
          {
            key: 'actions',
            header: tc('actions'),
            render: (r) =>
              can(PERMISSIONS.RESERVATIONS_WRITE) ? (
                <button
                  type="button"
                  className="text-[#2980B9] hover:underline"
                  onClick={() => openEdit(r)}
                >
                  {t('viewProfile')}
                </button>
              ) : null,
          },
        ]}
        rows={filteredRows as (GuestRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        onAdd={can(PERMISSIONS.RESERVATIONS_WRITE) ? openCreate : undefined}
        addLabel={t('addGuest')}
        emptyMessage={t('empty')}
      />

      <GuestCardModal
        open={cardOpen}
        guestId={cardGuestId}
        onClose={() => {
          setCardOpen(false);
          setCardGuestId(null);
          void load();
        }}
      />
    </>
  );
}
`,
);

writeUtf8(
  'src/components/wave-b/SimpleCrudPage.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraDataGrid,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

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

function rowMatches(row: Record<string, unknown>, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return Object.values(row).some((v) => {
    if (v == null) return false;
    if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(needle);
    return String(v).toLowerCase().includes(needle);
  });
}

export function SimpleCrudPage<T extends Record<string, unknown>>({
  title,
  apiPath,
  columns,
  canWrite,
  onAdd,
}: Props<T>) {
  const tc = useTranslations('common');
  const [rows, setRows] = useState<T[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiPath);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : data.items ?? data.inHouse ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [apiPath, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => rowMatches(r as Record<string, unknown>, searchApplied)),
    [rows, searchApplied],
  );

  return (
    <>
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
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft('');
          setSearchApplied('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
      </EraListFilterBar>
      <EraDataGrid<T>
        columns={columns.map((c) => ({
          key: String(c.key),
          header: c.header,
          render: c.render ? (row: T) => c.render!(row) : undefined,
        }))}
        rows={filtered}
        rowKey={(r) => String(r.id ?? JSON.stringify(r))}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

console.log('part1 ready');
