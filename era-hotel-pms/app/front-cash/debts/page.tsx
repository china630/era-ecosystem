'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  CHIP_ACTIVE_CLASS,
  CHIP_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  useDebouncedValue,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { PERMISSIONS } from '@/lib/auth/permissions';
import AgencyLedgerPage from '../agency-ledger/page';
import CompanyLedgerPage from '../company-ledger/page';

type Kind = 'guest' | 'agency' | 'company';

type DebtRow = {
  id: string;
  createdAt: string;
  amount: number;
  paid: number;
  remaining: number;
  note: string;
  reservationId: string;
  guestName: string | null;
  roomNumber: string | null;
  actor: string | null;
};

const KINDS: Kind[] = ['guest', 'agency', 'company'];

function kindFrom(value: string | null): Kind {
  return value === 'agency' || value === 'company' ? value : 'guest';
}

export default function DebtsPage() {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname() ?? '/front-cash/debts';
  const searchParams = useSearchParams();
  const kind = kindFrom(searchParams.get('kind'));

  function selectKind(next: Kind) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('kind', next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader title={t('debtsTitle')} subtitle={t('debtsHint')} />
      <div className="flex flex-wrap gap-2">
        {KINDS.map((code) => (
          <button
            key={code}
            type="button"
            className={kind === code ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            onClick={() => selectKind(code)}
          >
            {t(`debtsChip.${code}`)}
          </button>
        ))}
      </div>
      {kind === 'guest' ? <GuestDebtPanel /> : null}
      {kind === 'agency' ? <AgencyLedgerPage /> : null}
      {kind === 'company' ? <CompanyLedgerPage /> : null}
    </div>
  );
}

function GuestDebtPanel() {
  const { can } = useAuth();
  const t = useTranslations('folio');
  const tPay = useTranslations('paymentMethod');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [dateQ, setDateQ] = useState('');
  const [guestQ, setGuestQ] = useState('');
  const [roomQ, setRoomQ] = useState('');
  const [noteQ, setNoteQ] = useState('');
  const [status, setStatus] = useState('open');
  const guestFilter = useDebouncedValue(guestQ, 300);
  const roomFilter = useDebouncedValue(roomQ, 300);
  const noteFilter = useDebouncedValue(noteQ, 300);
  const [paying, setPaying] = useState<DebtRow | null>(null);

  const load = useCallback(() => {
    void fetch('/api/front-cash/guest-debt')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          showApiError(body);
          setRows([]);
          return;
        }
        const list = (Array.isArray(body) ? body : body?.data) as DebtRow[];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => showApiError({ error: tc('failed') }));
  }, [tc]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const guest = guestFilter.trim().toLowerCase();
    const room = roomFilter.trim().toLowerCase();
    const note = noteFilter.trim().toLowerCase();
    return rows.filter((row) => {
      if (dateQ && hotelDateKey(row.createdAt) !== dateQ) return false;
      if (status === 'open' && row.remaining <= 0.009) return false;
      if (status === 'closed' && row.remaining > 0.009) return false;
      if (guest && !(row.guestName ?? '').toLowerCase().includes(guest)) return false;
      if (room && !(row.roomNumber ?? '').toLowerCase().includes(room)) return false;
      if (note && !row.note.toLowerCase().includes(note)) return false;
      return true;
    });
  }, [rows, dateQ, guestFilter, roomFilter, noteFilter, status]);

  return (
    <>
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setDateQ('');
          setGuestQ('');
          setRoomQ('');
          setNoteQ('');
          setStatus('open');
        }}
      >
        <DatePicker
          label={t('debtDate')}
          value={dateQ}
          onChange={setDateQ}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <Field label={t('debtGuest')} preset="shortText" value={guestQ} onChange={(e) => setGuestQ(e.target.value)} />
        <Field label={t('debtRoom')} preset="code" value={roomQ} onChange={(e) => setRoomQ(e.target.value)} />
        <Field label={t('guestDebtNote')} preset="shortText" value={noteQ} onChange={(e) => setNoteQ(e.target.value)} />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc('status')}
          value={status}
          onChange={(next) => setStatus(String(next))}
          emptyLabel={null}
          options={[
            { value: 'open', label: t('debtOpen') },
            { value: 'closed', label: t('debtClosed') },
            { value: 'all', label: t('debtAll') },
          ]}
        />
      </EraListFilterBar>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtWhen')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtGuest')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtRoom')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('amount')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtPaid')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtRemaining')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('guestDebtNote')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('debtCashier')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.guestName ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.roomNumber ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.amount.toFixed(2)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.paid.toFixed(2)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.remaining.toFixed(2)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.note}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.actor ?? '—'}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {row.remaining > 0.009 && can(PERMISSIONS.FOLIO_PAYMENT) ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPaying(row)}>
                      {t('debtPay')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td colSpan={9} className={DATA_TABLE_TD_CLASS}>
                  {t('guestDebtEmpty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PayDebtModal
        row={paying}
        methodLabel={(code) => tPay(code as 'CASH')}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          load();
        }}
      />
    </>
  );
}

function PayDebtModal({
  row,
  methodLabel,
  onClose,
  onPaid,
}: {
  row: DebtRow | null;
  methodLabel: (code: string) => string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [terminal, setTerminal] = useState('');
  const [terminals, setTerminals] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setAmount(row.remaining.toFixed(2));
    setMethod('CASH');
    setTerminal('');
  }, [row]);

  useEffect(() => {
    if (!row) return;
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        setTerminals(body?.devices ?? []);
      })
      .catch(() => setTerminals([]));
  }, [row]);

  async function submit() {
    if (!row) return;
    const value = Math.round(Number(amount) * 100) / 100;
    if (!(value > 0) || value - row.remaining > 0.001) {
      showApiError({ error: t('debtAmountHigh') });
      return;
    }
    if (method === 'CARD' && !terminal) {
      showApiError({ error: t('debtPickTerminal') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/front-cash/guest-debt/${row.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: value,
          paymentMethod: method,
          bankTerminalId: method === 'CARD' ? terminal : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('debtPaidDone'));
      onPaid();
    } finally {
      setBusy(false);
    }
  }

  return (
    <EraModal
      open={row != null}
      title={t('debtPayTitle')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={() => void submit()}
          busy={busy}
          submitLabel={t('debtPay')}
        />
      }
    >
      {row ? (
        <div className="space-y-3">
          <p className="m-0 text-[13px] text-[#34495E]">
            {row.guestName ?? '—'} · {row.roomNumber ?? '—'} · {t('debtRemaining')} {row.remaining.toFixed(2)}
          </p>
          <Field
            label={tc('amount')}
            preset="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('debtMethod')}
            value={method}
            onChange={(next) => setMethod(String(next))}
            emptyLabel={null}
            options={['CASH', 'CARD', 'BANK_TRANSFER'].map((code) => ({
              value: code,
              label: methodLabel(code),
            }))}
          />
          {method === 'CARD' ? (
            <CatalogField
              kind="CLOSED_MEDIUM"
              label={t('debtTerminal')}
              value={terminal}
              onChange={(next) => setTerminal(String(next))}
              options={terminals.map((device) => ({ value: device.id, label: device.label }))}
            />
          ) : null}
        </div>
      ) : null}
    </EraModal>
  );
}
