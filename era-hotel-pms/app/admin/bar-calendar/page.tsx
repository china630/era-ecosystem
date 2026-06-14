'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@era/satellite-kit/ui';
import { MODAL_INPUT_CLASS, PRIMARY_BUTTON_CLASS } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type BarRate = {
  id: string;
  roomTypeId: string;
  roomTypeCode: string;
  date: string;
  amount: number;
};

export default function BarCalendarPage() {
  const { can } = useAuth();
  const [rates, setRates] = useState<BarRate[]>([]);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/master/bar-rates?from=${from}&to=${to}`);
    const data = await res.json();
    if (res.ok) setRates(data.rates ?? []);
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCell(id: string, amount: string) {
    const res = await fetch(`/api/master/bar-rates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    setMsg(res.ok ? 'Saved' : 'Save failed');
    await load();
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell>
        <p className="text-[13px] text-[#7F8C8D]">Master data permission required.</p>
      </AppShell>
    );
  }

  const roomTypes = [...new Set(rates.map((r) => r.roomTypeCode))].sort();
  const dates = [...new Set(rates.map((r) => r.date))].sort();

  return (
    <AppShell maxWidthClass="max-w-6xl">
      <PageHeader
        title="BAR calendar"
        leading={
          <Link href="/admin/master-data" className="text-[13px] text-[#2980B9] hover:underline">
            Master data
          </Link>
        }
      />
      <PageSection className="mb-4 flex flex-wrap gap-2">
        <input type="date" className={MODAL_INPUT_CLASS} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={MODAL_INPUT_CLASS} value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          Refresh
        </button>
      </PageSection>
      <StatusMessage>{msg}</StatusMessage>
      <div className="overflow-x-auto rounded-lg border border-[#D5DADF]">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="p-2 text-left">Room type</th>
              {dates.map((d) => (
                <th key={d} className="p-2 text-right whitespace-nowrap">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => (
              <tr key={rt} className="border-t border-[#ECEFF1]">
                <td className="p-2 font-medium">{rt}</td>
                {dates.map((d) => {
                  const cell = rates.find((r) => r.roomTypeCode === rt && r.date === d);
                  return (
                    <td key={d} className="p-1 text-right">
                      {cell ? (
                        <input
                          type="number"
                          className="w-16 rounded border border-[#D5DADF] px-1 py-0.5 text-right"
                          defaultValue={cell.amount}
                          onBlur={(e) => void saveCell(cell.id, e.target.value)}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
