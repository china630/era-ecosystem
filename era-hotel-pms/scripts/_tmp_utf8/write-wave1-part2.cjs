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
  'app/reports/reservations/page.tsx',
  `'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  EraDataGrid,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { MessageSquare } from 'lucide-react';
import ReservationCardModal from '@/components/ReservationCardModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { fullName: string };
  room: { roomNumber: string; status: string } | null;
  roomType: { code: string };
  agency: { code: string } | null;
  adults: number;
  hasNotes?: boolean;
  notePreview?: string | null;
};

const rowBg: Record<string, string> = {
  IN_HOUSE: 'bg-amber-50',
  CONFIRMED: 'bg-white',
  OPTION: 'bg-slate-50',
  CHECKED_OUT: 'bg-[#EBEDF0]',
  CANCELLED: 'bg-rose-50/50',
  NO_SHOW: 'bg-rose-50',
};

export default function ReservationsListPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationList');
  const tRes = useTranslations('reservationStatus');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [notesOnly, setNotesOnly] = useState(searchParams.get('hasNotes') === '1');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const guestIdFilter = searchParams.get('guestId');

  const load = useCallback(async () => {
    try {
      const q = guestIdFilter ? \`?guestId=\${encodeURIComponent(guestIdFilter)}\` : '';
      const res = await fetch(\`/api/reports/reservations-grid\${q}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc, guestIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNotesOnly(searchParams.get('hasNotes') === '1');
  }, [searchParams]);

  const displayed = useMemo(() => {
    let list = rows;
    if (notesOnly) list = list.filter((r) => r.hasNotes);
    const q = searchApplied.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        \`\${r.guest.fullName} \${r.room?.roomNumber ?? ''} \${r.agency?.code ?? ''} \${r.id}\`
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [rows, notesOnly, searchApplied]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {can(PERMISSIONS.RESERVATIONS_WRITE) ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
                {t('add')}
              </button>
            ) : null}
          </div>
        }
      />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft('');
          setSearchApplied('');
          setNotesOnly(false);
        }}
        actionsExtra={
          <button
            type="button"
            className={notesOnly ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setNotesOnly((v) => !v)}
          >
            {t('filterNotes')}
          </button>
        }
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
          {
            key: 'notes',
            header: t('notes'),
            render: (r) =>
              r.hasNotes ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-amber-700"
                  title={r.notePreview ?? ''}
                  onClick={() => setCardId(r.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-[8rem] truncate text-[12px]">{r.notePreview}</span>
                </button>
              ) : (
                '—'
              ),
          },
          {
            key: 'room',
            header: t('room'),
            render: (r) => r.room?.roomNumber ?? '—',
          },
          {
            key: 'hk',
            header: t('hk'),
            render: (r) => (r.room ? r.room.status.slice(0, 1) : '—'),
          },
          {
            key: 'agency',
            header: t('agency'),
            render: (r) => r.agency?.code ?? '—',
          },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          {
            key: 'arrival',
            header: t('arrival'),
            render: (r) => r.checkInDate.slice(0, 10),
          },
          {
            key: 'departure',
            header: t('departure'),
            render: (r) => r.checkOutDate.slice(0, 10),
          },
          { key: 'type', header: t('roomType'), render: (r) => r.roomType.code },
          { key: 'adult', header: t('adult'), render: (r) => String(r.adults ?? 1) },
          {
            key: 'state',
            header: t('state'),
            render: (r) => tRes(r.status as 'CONFIRMED'),
          },
          {
            key: 'id',
            header: t('resId'),
            render: (r) => (
              <button
                type="button"
                className="font-mono text-[#2980B9] hover:underline"
                onClick={() => setCardId(r.id)}
              >
                {r.id.slice(0, 8)}
              </button>
            ),
          },
        ]}
        rows={displayed.map((r) => ({
          ...r,
          _rowClass: \`\${rowBg[r.status] ?? ''} \${r.hasNotes ? 'ring-1 ring-inset ring-amber-300/80' : ''}\`,
        })) as (Row & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <ReservationCardModal
        open={Boolean(cardId) || createOpen}
        reservationId={createOpen ? null : cardId}
        onClose={() => {
          setCardId(null);
          setCreateOpen(false);
          void load();
        }}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/group-reservations/page.tsx',
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
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { GroupCreateModal } from '@/components/GroupCreateModal';
import ReservationCardModal from '@/components/ReservationCardModal';

type GroupRow = {
  id: string;
  code: string;
  name: string | null;
  groupBalance?: number;
  agency: { code: string; name: string } | null;
  reservations: Array<{
    id: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
  }>;
};

export default function GroupReservationsPage() {
  const { can } = useAuth();
  const t = useTranslations('groupReservations');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservation-groups');
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

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.code} \${r.name ?? ''} \${r.agency?.code ?? ''}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          can(PERMISSIONS.RESERVATIONS_WRITE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              {t('add')}
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
      <EraDataGrid<GroupRow & Record<string, unknown>>
        columns={[
          { key: 'code', header: t('code'), render: (r) => r.code },
          { key: 'name', header: t('name'), render: (r) => r.name ?? '—' },
          {
            key: 'agency',
            header: t('agency'),
            render: (r) => r.agency?.code ?? '—',
          },
          {
            key: 'rooms',
            header: t('rooms'),
            render: (r) => String(r.reservations.length),
          },
          {
            key: 'balance',
            header: t('balance'),
            render: (r) => (r.groupBalance != null ? r.groupBalance.toFixed(2) : '—'),
          },
          {
            key: 'guests',
            header: t('guests'),
            render: (r) =>
              r.reservations.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {r.reservations.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className="text-left font-mono text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setCardId(x.id)}
                    >
                      {x.guest.fullName}
                      {x.room ? \` · \${x.room.roomNumber}\` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                '—'
              ),
          },
        ]}
        rows={filtered as (GroupRow & Record<string, unknown>)[]}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <GroupCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      <ReservationCardModal
        open={Boolean(cardId)}
        reservationId={cardId}
        onClose={() => {
          setCardId(null);
          void load();
        }}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/reservation-times/page.tsx',
  `'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  guest: { fullName: string };
  checkInDate: string;
  checkOutDate: string;
  stay: { actualCheckIn: string; actualCheckOut: string | null } | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export default function ReservationTimesPage() {
  const { can } = useAuth();
  const t = useTranslations('reservationTimes');
  const tc = useTranslations('common');
  const [fromDraft, setFromDraft] = useState(todayIso);
  const [toDraft, setToDraft] = useState(() => plusDaysIso(7));
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(() => plusDaysIso(7));
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(\`/api/reports/reservation-times?from=\${from}&to=\${to}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => {
          setFrom(fromDraft);
          setTo(toDraft);
        }}
        onReset={() => {
          const f = todayIso();
          const t0 = plusDaysIso(7);
          setFromDraft(f);
          setToDraft(t0);
          setFrom(f);
          setTo(t0);
        }}
      >
        <DatePicker
          label={tc('from')}
          value={fromDraft}
          onChange={setFromDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={toDraft}
          onChange={setToDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'plannedIn', header: t('plannedIn'), render: (r) => r.checkInDate.slice(0, 10) },
          { key: 'plannedOut', header: t('plannedOut'), render: (r) => r.checkOutDate.slice(0, 10) },
          { key: 'actualIn', header: t('actualIn'), render: (r) => r.stay?.actualCheckIn?.slice(0, 16) ?? '—' },
          { key: 'actualOut', header: t('actualOut'), render: (r) => r.stay?.actualCheckOut?.slice(0, 16) ?? '—' },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/end-of-day-logs/page.tsx',
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
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  businessDay: { date: string };
  stepsJson: string | null;
  errorsJson: string | null;
};

export default function EndOfDayLogsPage() {
  const { can } = useAuth();
  const t = useTranslations('endOfDayLogs');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/night-audit-runs?limit=100');
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

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.status} \${r.businessDay.date}\`.toLowerCase().includes(q),
    );
  }, [rows, searchApplied]);

  if (!can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
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
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'date', header: t('businessDay'), render: (r) => r.businessDay.date.slice(0, 10) },
          { key: 'status', header: t('status') },
          { key: 'created', header: t('started'), render: (r) => r.createdAt.slice(0, 19) },
          {
            key: 'steps',
            header: t('steps'),
            render: (r) => {
              try {
                const steps = JSON.parse(r.stepsJson ?? '[]') as string[];
                return steps.length ? \`\${steps.length} steps\` : '—';
              } catch {
                return '—';
              }
            },
          },
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
  'app/reports/inhouse-daily/page.tsx',
  `'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DatePicker,
  EraDataGrid,
  EraListFilterBar,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  guest: { fullName: string };
  room: { roomNumber: string } | null;
  roomType: { code: string };
  checkInDate: string;
  checkOutDate: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InhouseDailyPage() {
  const { can } = useAuth();
  const t = useTranslations('inhouseDaily');
  const tc = useTranslations('common');
  const [dateDraft, setDateDraft] = useState(todayIso);
  const [date, setDate] = useState(todayIso);
  const [inHouse, setInHouse] = useState<Row[]>([]);
  const [departures, setDepartures] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(\`/api/reports/inhouse-daily?date=\${date}\`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setInHouse(data.inHouse ?? []);
      setDepartures(data.departures ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-sm text-[#7F8C8D]">{tc('accessDenied')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <EraListFilterBar
        applyLabel={tc('filterApply')}
        resetLabel={tc('filterReset')}
        onApply={() => setDate(dateDraft)}
        onReset={() => {
          const d = todayIso();
          setDateDraft(d);
          setDate(d);
        }}
      >
        <DatePicker
          label={tc('date')}
          value={dateDraft}
          onChange={setDateDraft}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>
      <h2 className="mb-2 text-[14px] font-semibold">{t('inHouse')}</h2>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
          { key: 'type', header: t('type'), render: (r) => r.roomType.code },
          { key: 'checkOut', header: t('departure'), render: (r) => r.checkOutDate.slice(0, 10) },
        ]}
        rows={inHouse}
        rowKey={(r) => r.id}
        emptyMessage={tc('empty')}
      />
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">{t('departuresToday')}</h2>
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'room', header: t('room'), render: (r) => r.room?.roomNumber ?? '—' },
          { key: 'guest', header: t('guest'), render: (r) => r.guest.fullName },
        ]}
        rows={departures}
        rowKey={(r) => \`d-\${r.id}\`}
        emptyMessage={tc('empty')}
      />
    </>
  );
}
`,
);

writeUtf8(
  'app/reports/room-changes/page.tsx',
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
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  status: string;
  effectiveAt: string;
  reservation: { guest: { fullName: string } };
  fromRoom: { roomNumber: string } | null;
  toRoom: { roomNumber: string } | null;
};

export default function RoomChangesPage() {
  const { can } = useAuth();
  const t = useTranslations('roomChanges');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/room-changes');
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

  const filtered = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      \`\${r.reservation.guest.fullName} \${r.fromRoom?.roomNumber ?? ''} \${r.toRoom?.roomNumber ?? ''} \${r.status}\`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchApplied]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
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
      <EraDataGrid<Row & Record<string, unknown>>
        columns={[
          { key: 'guest', header: t('guest'), render: (r) => r.reservation.guest.fullName },
          { key: 'from', header: t('from'), render: (r) => r.fromRoom?.roomNumber ?? '—' },
          { key: 'to', header: t('to'), render: (r) => r.toRoom?.roomNumber ?? '—' },
          { key: 'when', header: t('effective'), render: (r) => r.effectiveAt.slice(0, 16) },
          { key: 'status', header: t('status') },
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

console.log('part2 ready');
