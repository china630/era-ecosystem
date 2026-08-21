'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Field,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Contract = {
  id: string;
  code: string;
  ratePlanId: string;
  allotments: Array<{
    id: string;
    roomTypeId: string;
    nightlyQuota: number;
    roomType: { code: string; name: string };
  }>;
};

type Reservation = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest?: { fullName: string };
  roomType?: { code: string };
};

export default function AgencyPortalHomePage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [agencyCode, setAgencyCode] = useState('');
  const [salesContractId, setSalesContractId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guestFullName, setGuestFullName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const selected = useMemo(
    () => contracts.find((c) => c.id === salesContractId) ?? null,
    [contracts, salesContractId],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/reservations');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, 'Load failed');
        return;
      }
      setAgencyCode(data.agencyCode ?? '');
      setContracts(data.contracts ?? []);
      setReservations(data.reservations ?? []);
      if (data.contracts?.[0] && !salesContractId) {
        setSalesContractId(data.contracts[0].id);
        const firstAllot = data.contracts[0].allotments?.[0];
        if (firstAllot) setRoomTypeId(firstAllot.roomTypeId);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : 'Load failed' });
    }
  }, [salesContractId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createStay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/agency/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesContractId,
          roomTypeId,
          checkInDate,
          checkOutDate,
          guestFullName,
          guestPhone: guestPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, 'Create failed');
        return;
      }
      showSuccess(`Created ${data.status}`);
      setUploadId(data.id);
      setGuestFullName('');
      await load();
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : 'Create failed' });
    } finally {
      setBusy(false);
    }
  }

  async function uploadPassport(file: File) {
    if (!uploadId) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('kind', 'PASSPORT_SCAN');
    const res = await fetch(`/api/agency/reservations/${uploadId}/attachments`, {
      method: 'POST',
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, 'Upload failed');
      return;
    }
    showSuccess('Passport scan uploaded');
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Agency portal"
        subtitle={agencyCode ? `Agency ${agencyCode}` : 'Your contract bookings'}
      />

      <form className={FORM_STACK_CLASS} onSubmit={(e) => void createStay(e)}>
        <label className="text-sm">
          Contract
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={salesContractId}
            onChange={(ev) => {
              setSalesContractId(ev.target.value);
              const c = contracts.find((x) => x.id === ev.target.value);
              if (c?.allotments?.[0]) setRoomTypeId(c.allotments[0].roomTypeId);
            }}
            required
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Room type
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={roomTypeId}
            onChange={(ev) => setRoomTypeId(ev.target.value)}
            required
          >
            {(selected?.allotments ?? []).map((a) => (
              <option key={a.id} value={a.roomTypeId}>
                {a.roomType.code} (quota {a.nightlyQuota})
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Check-in"
          preset="shortText"
          type="date"
          value={checkInDate}
          onChange={(e) => setCheckInDate(e.target.value)}
          required
        />
        <Field
          label="Check-out"
          preset="shortText"
          type="date"
          value={checkOutDate}
          onChange={(e) => setCheckOutDate(e.target.value)}
          required
        />
        <Field
          label="Guest full name"
          preset="longText"
          value={guestFullName}
          onChange={(e) => setGuestFullName(e.target.value)}
          required
        />
        <Field
          label="Guest phone"
          preset="shortText"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
        />
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={busy}>
          {busy ? '…' : 'Create booking'}
        </button>
      </form>

      {uploadId ? (
        <label className="block text-sm">
          Optional passport scan (last booking)
          <input
            type="file"
            accept="image/*,application/pdf"
            className="mt-1 block"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPassport(f);
            }}
          />
        </label>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">My reservations</h2>
        <ul className="space-y-2 text-sm">
          {reservations.map((r) => (
            <li key={r.id} className="rounded border px-3 py-2">
              {r.guest?.fullName} · {r.roomType?.code} ·{' '}
              {String(r.checkInDate).slice(0, 10)} → {String(r.checkOutDate).slice(0, 10)} ·{' '}
              <strong>{r.status}</strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
