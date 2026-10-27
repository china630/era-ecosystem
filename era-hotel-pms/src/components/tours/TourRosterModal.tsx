'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bus,
  Check,
  CreditCard,
  Lock,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  CatalogField,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { TourDepartureStatusBadge, TourMoneyBadge } from '@/components/tours/tour-status-badge';

type Booking = {
  id: string;
  status: string;
  reservation: {
    id: string;
    guest: { fullName: string; phone: string | null };
    room: { roomNumber: string } | null;
    status: string;
  };
};

export type TourDepartureDetail = {
  id: string;
  date: string;
  pickupAt: string;
  returnAt: string;
  agenda: string;
  meetingPoint: string;
  guideName: string | null;
  capacity: number;
  price: number | string;
  status: string;
  vehicleId: string | null;
  vehicle: { code: string; licensePlate: string; maxSeats: number } | null;
  bookings: Booking[];
};

type Stay = {
  id: string;
  guest: { fullName: string };
  room: { roomNumber: string } | null;
  status: string;
};

const ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;
const addFormId = 'tour-roster-add-guest';
const payFormId = 'tour-roster-pay';
const closeFormId = 'tour-roster-close-boarding';

type Props = {
  open: boolean;
  departureId: string | null;
  onClose: () => void;
  onEdit: (dep: TourDepartureDetail) => void;
  onChanged: () => void;
};

export function TourRosterModal({ open, departureId, onClose, onEdit, onChanged }: Props) {
  const t = useTranslations('tours');
  const tc = useTranslations('common');
  const [dep, setDep] = useState<TourDepartureDetail | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankTerminalId, setBankTerminalId] = useState('');
  const [bankTerminals, setBankTerminals] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!departureId) return;
    const res = await fetch(`/api/tours/departures/${departureId}`);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    const data = (await res.json()) as TourDepartureDetail;
    setDep(data);
    const next: Record<string, boolean> = {};
    for (const b of data.bookings) {
      if (b.status === 'RESERVED') next[b.id] = false;
      else if (['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status)) next[b.id] = true;
    }
    setSelected(next);
  }, [departureId]);

  useEffect(() => {
    if (!open || !departureId) {
      setDep(null);
      return;
    }
    void load();
    void fetch('/api/tours/in-house')
      .then((r) => r.json())
      .then(setStays)
      .catch(() => undefined);
  }, [open, departureId, load]);

  const liveBookings = useMemo(
    () => (dep?.bookings ?? []).filter((b) => b.status !== 'CANCELLED'),
    [dep],
  );

  const reservedCount = liveBookings.filter((b) => b.status === 'RESERVED').length;
  const selectedReserved = Object.entries(selected).filter(
    ([id, on]) => on && liveBookings.some((b) => b.id === id && b.status === 'RESERVED'),
  ).length;
  const terminal = dep?.status === 'DEPARTED' || dep?.status === 'CANCELLED';
  const canMutate = !!dep && !terminal;

  function moneyLabel(status: string) {
    const map: Record<string, string> = {
      RESERVED: t('reserved'),
      CHARGED: t('charged'),
      PAID: t('paid'),
      ON_CITY_LEDGER: t('onCityLedger'),
      CANCELLED: t('statusCancelled'),
    };
    return map[status] ?? status;
  }

  function departureStatusLabel(status: string) {
    const map: Record<string, string> = {
      DRAFT: t('statusDraft'),
      OPEN: t('statusOpen'),
      CLOSED: t('statusClosed'),
      DEPARTED: t('statusDeparted'),
      CANCELLED: t('statusCancelled'),
    };
    return map[status] ?? status;
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!departureId || !reservationId) return;
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${departureId}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('guestAdded'));
    setAddOpen(false);
    setReservationId('');
    await load();
    onChanged();
  }

  async function openPay(bookingId: string) {
    setPaymentMethod('CASH');
    setBankTerminalId('');
    setPayOpen(bookingId);
    try {
      const res = await fetch('/api/fiscal/devices?kind=BANK_POS');
      if (!res.ok) {
        setBankTerminals([]);
        return;
      }
      const data = await res.json();
      const devices = (data.devices ?? []) as Array<{ id: string; label?: string; name?: string }>;
      setBankTerminals(devices.map((d) => ({ id: d.id, label: d.label || d.name || d.id })));
    } catch {
      setBankTerminals([]);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!payOpen) return;
    if (paymentMethod === 'CARD') {
      if (bankTerminals.length === 0) {
        showApiError({ error: t('noBankTerminal') });
        return;
      }
      if (!bankTerminalId) {
        showApiError({ error: t('terminalRequired') });
        return;
      }
    }
    setBusy(true);
    const res = await fetch(`/api/tours/bookings/${payOpen}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod,
        bankTerminalId: paymentMethod === 'CARD' ? bankTerminalId || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('paidOk'));
    setPayOpen(null);
    await load();
    onChanged();
  }

  async function remove(bookingId: string) {
    const res = await fetch(`/api/tours/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Tour booking cancelled' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('removed'));
    await load();
    onChanged();
  }

  async function boardSelected() {
    const ids = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([bid]) => bid)
      .filter((bid) => liveBookings.some((b) => b.id === bid && b.status === 'RESERVED'));
    if (ids.length === 0) {
      showApiError({ error: t('selectToBoard') });
      return;
    }
    setBusy(true);
    for (const bid of ids) {
      const res = await fetch(`/api/tours/bookings/${bid}/board`, { method: 'POST' });
      if (!res.ok) {
        setBusy(false);
        showApiError(await res.json().catch(() => ({ error: res.statusText })));
        return;
      }
    }
    setBusy(false);
    showSuccess(t('boardedOk'));
    await load();
    onChanged();
  }

  async function closeBoarding(e: React.FormEvent) {
    e.preventDefault();
    if (!departureId) return;
    const boardedBookingIds = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([bid]) => bid)
      .filter((bid) => liveBookings.some((b) => b.id === bid && b.status === 'RESERVED'));
    setBusy(true);
    const res = await fetch(`/api/tours/departures/${departureId}/close-boarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardedBookingIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showApiError(data);
      return;
    }
    const boarded = Number(data.boardedCount ?? boardedBookingIds.length);
    const dropped = Number(data.droppedCount ?? 0);
    showSuccess(t('boardingClosedMeta', { boarded, dropped }));
    setCloseOpen(false);
    await load();
    onChanged();
  }

  async function markDeparted() {
    if (!departureId || !dep?.vehicleId) {
      showApiError({ error: t('vehicleRequiredForDepart') });
      return;
    }
    const res = await fetch(`/api/tours/departures/${departureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DEPARTED' }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({ error: res.statusText })));
      return;
    }
    showSuccess(t('markDeparted'));
    await load();
    onChanged();
  }

  function openPrint() {
    if (!departureId) return;
    window.open(`/tours/${departureId}/print?autoprint=1`, '_blank', 'noopener,noreferrer');
  }

  if (!open) return null;

  return (
    <>
      <EraModal
        open={open}
        title={dep?.agenda || t('rosterTitle')}
        subtitle={
          dep
            ? `${dep.date.slice(0, 10)} · ${departureStatusLabel(dep.status)} · ${liveBookings.length}/${dep.capacity}`
            : undefined
        }
        onClose={onClose}
        maxWidthClass="max-w-5xl"
        headerActions={
          dep ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {canMutate ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  title={t('edit')}
                  aria-label={t('edit')}
                  onClick={() => onEdit(dep)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
              {canMutate ? (
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} !px-3`}
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t('addGuest')}
                </button>
              ) : null}
              {canMutate && reservedCount > 0 ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  title={t('boardSelected')}
                  aria-label={t('boardSelected')}
                  disabled={busy || selectedReserved === 0}
                  onClick={() => void boardSelected()}
                >
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
              {canMutate && reservedCount > 0 ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  title={t('closeBoarding')}
                  aria-label={t('closeBoarding')}
                  onClick={() => setCloseOpen(true)}
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                className={ICON_BTN}
                title={t('print')}
                aria-label={t('print')}
                onClick={openPrint}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
              </button>
              {canMutate ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  title={t('markDeparted')}
                  aria-label={t('markDeparted')}
                  disabled={!dep.vehicleId}
                  onClick={() => void markDeparted()}
                >
                  <Bus className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {!dep ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#34495E]">
              <TourDepartureStatusBadge status={dep.status} label={departureStatusLabel(dep.status)} />
              <span>
                {t('pickup')}: {bakuDateTimeDisplay(dep.pickupAt)} → {t('return')}:{' '}
                {bakuDateTimeDisplay(dep.returnAt)}
              </span>
            </div>
            <p className="m-0 text-[13px] text-[#34495E]">
              {t('meetingPoint')}: {dep.meetingPoint?.trim() || t('notSet')}
              {' · '}
              {t('guide')}: {dep.guideName?.trim() || t('notSet')}
              {' · '}
              {t('vehicle')}:{' '}
              {dep.vehicle ? `${dep.vehicle.code} ${dep.vehicle.licensePlate}` : t('vehicleMissing')}
              {' · '}
              {t('price')}: {Number(dep.price)}
            </p>
            {!dep.vehicleId && canMutate ? (
              <p className="m-0 text-[12px] text-[#9A7D0A]">{t('vehicleMissingHint')}</p>
            ) : null}

            <HotelDataGrid<Booking & Record<string, unknown>>
              columns={[
                {
                  key: 'board',
                  header: t('boarded'),
                  render: (b) =>
                    b.status === 'RESERVED' ? (
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={!!selected[b.id]}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t('boarded')}
                      />
                    ) : (
                      <span className="text-[#27AE60]" aria-hidden>
                        {['CHARGED', 'PAID', 'ON_CITY_LEDGER'].includes(b.status) ? (
                          <Check className="inline h-3.5 w-3.5" />
                        ) : (
                          '—'
                        )}
                      </span>
                    ),
                },
                {
                  key: 'room',
                  header: t('room'),
                  render: (b) => b.reservation.room?.roomNumber ?? '—',
                },
                {
                  key: 'guest',
                  header: tc('guest'),
                  render: (b) => b.reservation.guest.fullName,
                },
                {
                  key: 'money',
                  header: t('moneyStatus'),
                  render: (b) => <TourMoneyBadge status={b.status} label={moneyLabel(b.status)} />,
                },
                {
                  key: 'actions',
                  header: tc('actions'),
                  render: (b) => (
                    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      {b.status === 'CHARGED' ? (
                        <button
                          type="button"
                          className={ICON_BTN}
                          title={t('pay')}
                          aria-label={t('pay')}
                          onClick={() => void openPay(b.id)}
                        >
                          <CreditCard className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      {b.status !== 'CANCELLED' && canMutate ? (
                        <button
                          type="button"
                          className={ICON_BTN}
                          title={t('remove')}
                          aria-label={t('remove')}
                          onClick={() => void remove(b.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              rows={liveBookings}
              rowKey={(r) => r.id}
              emptyMessage={t('emptyRoster')}
            />
          </div>
        )}
      </EraModal>

      <EraModal
        open={addOpen}
        title={t('addGuest')}
        onClose={() => setAddOpen(false)}
        footer={
          <EraModalFooter
            formId={addFormId}
            onCancel={() => setAddOpen(false)}
            busy={busy}
            submitLabel={t('addGuest')}
          />
        }
      >
        <form id={addFormId} onSubmit={addGuest} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="ENTITY_REF"
            label={t('guestStay')}
            value={reservationId}
            onChange={(v) => setReservationId(String(v ?? ''))}
            options={stays.map((r) => ({
              value: r.id,
              label: `${r.room?.roomNumber ?? '—'} · ${r.guest.fullName} · ${r.status}`,
            }))}
            required
            emptyLabel={null}
          />
        </form>
      </EraModal>

      <EraModal
        open={!!payOpen}
        title={t('pay')}
        onClose={() => setPayOpen(null)}
        footer={
          <EraModalFooter formId={payFormId} onCancel={() => setPayOpen(null)} busy={busy} submitLabel={t('pay')} />
        }
      >
        <form id={payFormId} onSubmit={pay} className={FORM_STACK_CLASS}>
          <CatalogField
            kind="OPS_HOT"
            label={t('paymentMethod')}
            value={paymentMethod}
            onChange={(v) => {
              setPaymentMethod(String(v));
              setBankTerminalId('');
            }}
            options={[
              { value: 'CASH', label: t('tenderCash') },
              { value: 'CARD', label: t('tenderCard') },
              { value: 'BANK_TRANSFER', label: t('tenderBank') },
            ]}
          />
          {paymentMethod === 'CARD' ? (
            bankTerminals.length > 0 ? (
              <CatalogField
                kind="ENTITY_REF"
                label={t('bankTerminal')}
                value={bankTerminalId}
                onChange={(v) => setBankTerminalId(String(v ?? ''))}
                options={bankTerminals.map((row) => ({ value: row.id, label: row.label }))}
                required
                emptyLabel={null}
              />
            ) : (
              <p className="m-0 text-[13px] text-[#922B21]">{t('noBankTerminal')}</p>
            )
          ) : null}
          {dep ? <p className="text-[13px]">{t('price')}: {Number(dep.price)}</p> : null}
        </form>
      </EraModal>

      <EraModal
        open={closeOpen}
        title={t('closeBoarding')}
        onClose={() => setCloseOpen(false)}
        footer={
          <EraModalFooter
            formId={closeFormId}
            onCancel={() => setCloseOpen(false)}
            busy={busy}
            submitLabel={t('closeBoarding')}
          />
        }
      >
        <form id={closeFormId} onSubmit={closeBoarding} className={FORM_STACK_CLASS}>
          <p className="text-[13px]">{t('closeBoardingHint')}</p>
          <p className="text-[12px] text-[#7F8C8D]">
            {t('boardSelectedCount', { count: selectedReserved })}
          </p>
        </form>
      </EraModal>
    </>
  );
}
