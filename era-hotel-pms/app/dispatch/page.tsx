'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CARD_CONTAINER_CLASS,
  PageHeader } from '@era/satellite-kit/ui';
import { MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@era/satellite-kit/ui';

type Request = {
  id: string;
  fromLabel: string;
  toLabel: string;
  status: string;
  guest?: { fullName: string } | null;
  vehicle?: { code: string } | null;
};

type Vehicle = { id: string; code: string; name: string };

export default function DispatchPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    const data = await fetch('/api/dispatch').then((r) => r.json());
    setRequests(data.requests ?? []);
    setVehicles(data.vehicles ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest() {
    await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromLabel: from, toLabel: to }),
    });
    setFrom('');
    setTo('');
    await load();
  }

  async function assign(id: string, vehicleId: string) {
    await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', id, vehicleId }),
    });
    await load();
  }

  return (
    <>
      <PageHeader title="Guest dispatch" />
      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-4 flex flex-wrap gap-2`}>
        <input className={MODAL_INPUT_CLASS} placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className={MODAL_INPUT_CLASS} placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createRequest()}>
          Queue request
        </button>
      </section>
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <ul className="space-y-2 text-[13px]">
          {requests.map((r) => (
            <li key={r.id} className="rounded border border-[#ECEFF1] p-2">
              <div>{r.fromLabel} → {r.toLabel} · {r.status}</div>
              {r.guest?.fullName && <div className="text-[#7F8C8D]">{r.guest.fullName}</div>}
              {r.status === 'QUEUED' && vehicles[0] && (
                <button
                  type="button"
                  className={`mt-1 ${SECONDARY_BUTTON_CLASS}`}
                  onClick={() => void assign(r.id, vehicles[0].id)}
                >
                  Assign {vehicles[0].code}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
