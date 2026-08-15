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
  'app/in-house/page.tsx',
  `'use client';

import Link from 'next/link';
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

type InHouseGuest = {
  reservationId: string;
  guestId: string;
  guestName: string;
  roomNumber: string | null;
  status: string;
};

export default function InHousePage() {
  const { can } = useAuth();
  const t = useTranslations('inHousePage');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<InHouseGuest[]>([]);
  const [guestCardId, setGuestCardId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations?status=IN_HOUSE');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setRows(
        list.map(
          (r: {
            id: string;
            status: string;
            guest: { id: string; fullName: string };
            room: { roomNumber: string } | null;
          }) => ({
            reservationId: r.id,
            guestId: r.guest.id,
            guestName: r.guest.fullName,
            roomNumber: r.room?.roomNumber ?? null,
            status: r.status,
          }),
        ),
      );
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.guestName} \${r.roomNumber ?? ''} \${r.status}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  if (!can(PERMISSIONS.FOLIO_READ) && !can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
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
      <EraDataGrid<InHouseGuest & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.roomNumber ?? '—' },
          {
            key: 'guest',
            header: t('guest'),
            render: (r) => (
              <button
                type="button"
                className="text-[#2980B9] hover:underline"
                onClick={() => setGuestCardId(r.guestId)}
              >
                {r.guestName}
              </button>
            ),
          },
          { key: 'status', header: tc('status'), render: (r) => r.status },
          {
            key: 'folio',
            header: t('folio'),
            render: (r) =>
              can(PERMISSIONS.FOLIO_READ) ? (
                <Link
                  href={\`/folio/\${r.reservationId}\`}
                  className="text-[#2980B9] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('openFolio')}
                </Link>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (InHouseGuest & Record<string, unknown>)[]}
        rowKey={(r) => r.reservationId}
        emptyMessage={t('empty')}
      />
      <GuestCardModal
        open={Boolean(guestCardId)}
        guestId={guestCardId}
        onClose={() => setGuestCardId(null)}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/transfers/airport/page.tsx',
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
import Link from 'next/link';

type Row = {
  id: string;
  pickupAt: string;
  flightNo: string | null;
  status: string;
  reservation: { guest: { fullName: string } };
  vehicle: { code: string } | null;
};

export default function AirportTransferPage() {
  const t = useTranslations('airportTransfer');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/transfers/orders');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (Array.isArray(data)) {
        setRows(data.filter((o: Row) => o.flightNo != null && o.flightNo.trim() !== ''));
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.reservation.guest.fullName} \${r.flightNo ?? ''} \${r.status}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/transfers" className="text-[#2980B9]">
          {t('allTransfers')}
        </Link>
      </p>
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
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: tc('guest'), render: (r) => r.reservation.guest.fullName },
          { key: 'flight', header: 'Flight', render: (r) => r.flightNo ?? '—' },
          { key: 'pickup', header: 'Pickup', render: (r) => r.pickupAt.slice(0, 16) },
          { key: 'status', header: tc('status') },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/spa/reservations/page.tsx',
  `'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EraDataGrid,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';

type Row = {
  id: string;
  startAt: string;
  staffName: string | null;
  placeCode: string | null;
  service: { name: string };
  reservation: { guest: { fullName: string } };
};

export default function SpaReservationsPage() {
  const t = useTranslations('spaReservationList');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/procedures/appointments');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (Array.isArray(data)) setRows(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.reservation.guest.fullName} \${r.service.name} \${r.placeCode ?? ''} \${r.staffName ?? ''}\`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-2 text-[13px]">
        <Link href="/procedures" className="text-[#2980B9]">
          {t('openScheduler')}
        </Link>
      </p>
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
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: tc('guest'), render: (r) => r.reservation.guest.fullName },
          { key: 'service', header: 'Service', render: (r) => r.service.name },
          { key: 'start', header: 'Start', render: (r) => r.startAt.slice(0, 16) },
          { key: 'place', header: 'Place', render: (r) => r.placeCode ?? '—' },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/spa/staff-match/page.tsx',
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

type Row = {
  staffName: string;
  serviceName: string;
  count: number;
};

export default function SpaStaffMatchPage() {
  const t = useTranslations('serviceStaffMatch');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/procedures/appointments');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      if (!Array.isArray(data)) return;
      const map = new Map<string, number>();
      for (const a of data) {
        const key = \`\${a.staffName ?? '—'}|\${a.service?.name ?? '—'}\`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      setRows(
        [...map.entries()].map(([k, count]) => {
          const [staffName, serviceName] = k.split('|');
          return { staffName, serviceName, count };
        }),
      );
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.staffName} \${r.serviceName}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  return (
    <>
      <PageHeader title={t('title')} />
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
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'staffName', header: t('staff') },
          { key: 'serviceName', header: t('service') },
          { key: 'count', header: t('appointments') },
        ]}
        rows={filtered}
        rowKey={(r) => \`\${r.staffName}-\${r.serviceName}\`}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/banquets/reports/profitability/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  EraListFilterBar,
  Field,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageSection } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  eventName: string;
  eventDate: string;
  saloon: string;
  pax: number;
  status: string;
  plannedRevenue: number;
  actualRevenue: number;
  variance: number;
  counterparty: string | null;
};

export default function EventProfitabilityPage() {
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/event-profitability');
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
    if (can(PERMISSIONS.REPORTS_READ)) void load();
  }, [can, load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.eventName} \${r.saloon} \${r.counterparty ?? ''}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('profitabilityTitle')}
        subtitle={t('profitabilitySubtitle')}
        actions={
          <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
            {tc('back')}
          </Link>
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
      <PageSection>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2">{t('eventDate')}</th>
              <th className="py-2">{t('eventName')}</th>
              <th className="py-2">{t('saloon')}</th>
              <th className="py-2">{t('plannedRevenue')}</th>
              <th className="py-2">{t('actualRevenue')}</th>
              <th className="py-2">{t('variance')}</th>
              <th className="py-2">{t('counterparty')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2">{new Date(r.eventDate).toLocaleDateString()}</td>
                <td className="py-2">
                  <Link href={\`/banquets/\${r.id}\`} className="text-[#3498DB] underline">
                    {r.eventName}
                  </Link>
                </td>
                <td className="py-2">{r.saloon}</td>
                <td className="py-2">{r.plannedRevenue}</td>
                <td className="py-2">{r.actualRevenue}</td>
                <td className="py-2">{r.variance}</td>
                <td className="py-2">{r.counterparty ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageSection>
    </>
  );
}
`,
);

writeUtf8(
  'app/migration/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Row = {
  id: string;
  status: string;
  guestId: string;
  reservationId: string | null;
  createdAt: string;
  guest?: { fullName: string };
};

export default function MigrationQueuePage() {
  const t = useTranslations('migration');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/migration/registrations');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, t('loadFailed'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : t('loadFailed') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.guest?.fullName ?? ''} \${r.guestId} \${r.status} \${r.reservationId ?? ''}\`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchApplied]);

  async function prefill(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(\`/api/migration/registrations/\${id}/prefill\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('prefillFailed'));
        return;
      }
      showSuccess(t('prefillOk'));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function submit(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(\`/api/migration/\${id}/submit\`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('submitFailed'));
        return;
      }
      showSuccess(t('submitOk', { status: data.data?.status ?? data.status ?? 'SUBMITTED' }));
      await load();
    } finally {
      setBusyId(null);
    }
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
      <div className={\`\${CARD_CONTAINER_CLASS} p-4 text-[13px]\`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-[#7F8C8D]">
              <th className="py-2 pr-2">{t('guest')}</th>
              <th className="py-2 pr-2">{t('status')}</th>
              <th className="py-2 pr-2">{t('reservation')}</th>
              <th className="py-2 pr-2">{t('created')}</th>
              <th className="py-2">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-[#7F8C8D]">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-2">{r.guest?.fullName ?? r.guestId}</td>
                  <td className="py-2 pr-2">
                    <span className="rounded bg-[#ECF0F1] px-2 py-0.5 text-xs">{r.status}</span>
                  </td>
                  <td className="py-2 pr-2">{r.reservationId ?? '—'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs text-[#2980B9] disabled:opacity-50"
                        disabled={busyId === r.id}
                        onClick={() => void prefill(r.id)}
                      >
                        {t('prefill')}
                      </button>
                      <button
                        type="button"
                        className="rounded bg-[#2980B9] px-2 py-1 text-xs text-white disabled:opacity-50"
                        disabled={busyId === r.id}
                        onClick={() => void submit(r.id)}
                      >
                        {t('submit')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
`,
);

console.log('ops simple ready');
