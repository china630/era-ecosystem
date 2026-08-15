from pathlib import Path

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")

def w(rel: str, content: str):
    p = ROOT / rel
    p.write_text(content, encoding="utf-8", newline="\n")
    b = p.read_bytes()
    assert b[1] != 0, rel
    print("ok", rel, len(b))

w("app/transfers/page.tsx", r'''\'use client\';

import { useCallback, useEffect, useMemo, useState } from \'react\';
import { useSearchParams } from \'next/navigation\';
import { useTranslations } from \'next-intl\';
import { Plus } from \'lucide-react\';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from \'@era/satellite-kit/ui\';
import { EraModal, EraModalFooter } from \'@/components/EraModal\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

type Vehicle = {
  id: string;
  code: string;
  brand: string;
  licensePlate: string;
  driverName: string | null;
  maxSeats: number;
};

type TransferOrder = {
  id: string;
  direction: string;
  flightNo: string | null;
  pickupAt: string;
  status: string;
  folioCharged: boolean;
  price: string;
  notes: string | null;
  vehicle: Vehicle | null;
  reservation: {
    id: string;
    guest: { fullName: string };
    room: { roomNumber: string } | null;
  };
};

type Reservation = {
  id: string;
  guest: { fullName: string };
  status: string;
  room: { roomNumber: string } | null;
};

const bookFormId = \'book-transfer-form\';

export default function TransfersPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestIdFilter = searchParams.get(\'guestId\');
  const t = useTranslations(\'transfers\');
  const tc = useTranslations(\'common\');
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationId, setReservationId] = useState(\'\');
  const [direction, setDirection] = useState<\'IN\' | \'OUT\'>(\'IN\');
  const [flightNo, setFlightNo] = useState(\'\');
  const [pickupDate, setPickupDate] = useState(\'\');
  const [pickupTime, setPickupTime] = useState(\'12:00\');
  const [price, setPrice] = useState(\'35\');
  const [notes, setNotes] = useState(\'\');
  const [assignVehicleId, setAssignVehicleId] = useState<Record<string, string>>({});
  const [searchDraft, setSearchDraft] = useState(\'\');
  const [searchApplied, setSearchApplied] = useState(\'\');
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const transferQ = guestIdFilter ? `?guestId=${encodeURIComponent(guestIdFilter)}` : \'\';
    const [transferRes, resRes] = await Promise.all([
      fetch(`/api/transfers${transferQ}`),
      fetch(
        guestIdFilter
          ? `/api/reservations?guestId=${encodeURIComponent(guestIdFilter)}`
          : \'/api/reservations?status=IN_HOUSE\',
      ),
    ]);
    const transferData = await transferRes.json();
    const resData = await resRes.json();
    setOrders(transferData.orders ?? []);
    setVehicles(transferData.vehicles ?? []);
    setReservations(Array.isArray(resData) ? resData : []);
  }, [guestIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openBookModal() {
    setReservationId(\'\');
    setDirection(\'IN\');
    setFlightNo(\'\');
    setPickupDate(\'\');
    setPickupTime(\'12:00\');
    setPrice(\'35\');
    setNotes(\'\');
    setModalOpen(true);
  }

  if (!can(PERMISSIONS.RESERVATIONS_WRITE)) {
    return <p className="text-sm text-[#7F8C8D]">{tc(\'accessDenied\')}</p>;
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId || !pickupDate || !pickupTime || !price) {
      showApiError({ error: t(\'missingFields\') });
      return;
    }
    setBusy(true);
    const res = await fetch(\'/api/transfers\', {
      method: \'POST\',
      headers: { \'Content-Type\': \'application/json\' },
      body: JSON.stringify({
        reservationId,
        direction,
        flightNo: flightNo || undefined,
        pickupAt: new Date(`${pickupDate}T${pickupTime}`).toISOString(),
        price: Number(price),
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError(data, tc(\'error\'));
      return;
    }
    showSuccess(t(\'booked\'));
    setModalOpen(false);
    await load();
  }

  async function assign(orderId: string) {
    const vehicleId = assignVehicleId[orderId];
    if (!vehicleId) {
      showApiError({ error: t(\'selectVehicle\') });
      return;
    }
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: \'PATCH\',
      headers: { \'Content-Type\': \'application/json\' },
      body: JSON.stringify({ action: \'assign\', vehicleId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc(\'error\'));
      return;
    }
    showSuccess(t(\'assigned\'));
    await load();
  }

  async function complete(orderId: string) {
    const res = await fetch(`/api/transfers/${orderId}`, {
      method: \'PATCH\',
      headers: { \'Content-Type\': \'application/json\' },
      body: JSON.stringify({ action: \'complete\' }),
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc(\'error\'));
      return;
    }
    showSuccess(t(\'completed\'));
    await load();
  }

  const visibleOrders = useMemo(() => {
    const q = searchApplied.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      `${o.reservation.guest.fullName} ${o.flightNo ?? \'\'} ${o.status} ${o.direction}`
        .toLowerCase()
        .includes(q),
    );
  }, [orders, searchApplied]);

  return (
    <>
      <PageHeader
        title={t(\'title\')}
        subtitle={t(\'subtitle\')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openBookModal}>
            <Plus className="h-4 w-4" aria-hidden />
            {t(\'book\')}
          </button>
        }
      />

      <EraListFilterBar
        applyLabel={tc(\'filterApply\')}
        resetLabel={tc(\'filterReset\')}
        onApply={() => setSearchApplied(searchDraft)}
        onReset={() => {
          setSearchDraft(\'\');
          setSearchApplied(\'\');
        }}
      >
        <Field
          label={tc(\'search\')}
          preset="longText"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === \'Enter\') {
              e.preventDefault();
              setSearchApplied(searchDraft);
            }
          }}
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t(\'schedule\')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[#7F8C8D]">
                <th className="py-2 pr-3">{t(\'pickupAt\')}</th>
                <th className="py-2 pr-3">{t(\'guest\')}</th>
                <th className="py-2 pr-3">{t(\'direction\')}</th>
                <th className="py-2 pr-3">{t(\'flightNo\')}</th>
                <th className="py-2 pr-3">{t(\'vehicle\')}</th>
                <th className="py-2 pr-3">{t(\'price\')}</th>
                <th className="py-2 pr-3">{tc(\'status\')}</th>
                <th className="py-2">{tc(\'actions\')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => (
                <tr key={o.id} className="border-b border-[#ECF0F1]">
                  <td className="py-2 pr-3">{new Date(o.pickupAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {o.reservation.guest.fullName} · {o.reservation.room?.roomNumber ?? \'—\'}
                  </td>
                  <td className="py-2 pr-3">{o.direction === \'IN\' ? t(\'directionIn\') : t(\'directionOut\')}</td>
                  <td className="py-2 pr-3">{o.flightNo ?? \'—\'}</td>
                  <td className="py-2 pr-3">
                    {o.vehicle
                      ? `${o.vehicle.code} (${o.vehicle.licensePlate})`
                      : o.status === \'BOOKED\'
                        ? (
                            <select
                              className={MODAL_INPUT_CLASS}
                              value={assignVehicleId[o.id] ?? \'\'}
                              onChange={(e) =>
                                setAssignVehicleId((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                            >
                              <option value="">{tc(\'select\')}</option>
                              {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.code} — {v.brand}
                                </option>
                              ))}
                            </select>
                          )
                        : \'—\'}
                  </td>
                  <td className="py-2 pr-3">{o.price}</td>
                  <td className="py-2 pr-3">{o.status}</td>
                  <td className="py-2 space-x-2">
                    {o.status === \'BOOKED\' && !o.vehicle && (
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => assign(o.id)}>
                        {t(\'assign\')}
                      </button>
                    )}
                    {[\'BOOKED\', \'CONFIRMED\'].includes(o.status) && (
                      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => complete(o.id)}>
                        {t(\'complete\')}
                      </button>
                    )}
                    {o.folioCharged && o.status === \'DONE\' && (
                      <span className="text-[#7F8C8D]">{t(\'charged\')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-[#7F8C8D]">
                    {t(\'empty\')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={t(\'bookTransfer\')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={bookFormId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t(\'book\')}
          />
        }
      >
        <form id={bookFormId} onSubmit={book} className={FORM_STACK_CLASS}>
          <FieldSelect
            label={t(\'guestStay\')}
            preset="selectWide"
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            required
          >
            <option value="">{tc(\'select\')}</option>
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.guest.fullName} · {r.room?.roomNumber ?? \'—\'}
              </option>
            ))}
          </FieldSelect>
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label={t(\'direction\')}
              preset="select"
              value={direction}
              onChange={(e) => setDirection(e.target.value as \'IN\' | \'OUT\')}
            >
              <option value="IN">{t(\'directionIn\')}</option>
              <option value="OUT">{t(\'directionOut\')}</option>
            </FieldSelect>
            <Field label={t(\'flightNo\')} preset="code" value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t(\'pickupAt\')}
              value={pickupDate}
              onChange={setPickupDate}
              placeholder={tc(\'datePlaceholder\')}
              openCalendarLabel={tc(\'openCalendar\')}
              required
            />
            <Field
              label={tc(\'time\')}
              preset="time"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              required
            />
          </div>
          <Field
            label={t(\'price\')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Field label={t(\'notes\')} preset="longText" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </form>
      </EraModal>
    </>
  );
}
'''.replace("\\'", "'"))

print("transfers done")
