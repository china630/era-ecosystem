'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Agency {
  id: string;
  code: string;
  name: string;
}

interface Ledger {
  opening: number;
  newCharges: number;
  payments: number;
  closing: number;
  reservationCount: number;
}

export default function AgencyLedgerPage() {
  const { can } = useAuth();
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState<Ledger | null>(null);

  useEffect(() => {
    fetch('/api/agencies').then((r) => r.json()).then(setAgencies);
  }, []);

  async function load() {
    if (!agencyId) return;
    const res = await fetch(`/api/agencies/${agencyId}/ledger?from=${from}&to=${to}`);
    if (res.ok) setLedger(await res.json());
  }

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('agencyLedgerTitle')}</h1>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <select
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
        >
          <option value="">{t('agencySelect')}</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1" />
        <button type="button" onClick={load} className="rounded bg-sky-700 px-3 py-1">
          {tc('load')}
        </button>
      </div>
      {ledger && (
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-slate-500">{t('opening')}</td>
              <td>{ledger.opening.toFixed(2)} {tc('azn')}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">{t('newCharges')}</td>
              <td>{ledger.newCharges.toFixed(2)} {tc('azn')}</td>
            </tr>
            <tr>
              <td className="py-1 text-slate-500">{t('payments')}</td>
              <td>{ledger.payments.toFixed(2)} {tc('azn')}</td>
            </tr>
            <tr>
              <td className="py-1 font-medium text-slate-300">{t('closing')}</td>
              <td className="font-medium">{ledger.closing.toFixed(2)} {tc('azn')}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
