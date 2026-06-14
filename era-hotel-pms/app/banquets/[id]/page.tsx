'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Tab = 'lines' | 'resources' | 'staff' | 'settlement';

export default function BanquetDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const t = useTranslations('banquets');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<Tab>('lines');
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('100');
  const [staffRole, setStaffRole] = useState('WAITER');
  const [staffName, setStaffName] = useState('');

  const load = useCallback(async () => {
    const id = params.id;
    const [evRes, stRes, setRes] = await Promise.all([
      fetch(`/api/banquets/${id}`),
      fetch(`/api/banquets/${id}/staff`),
      fetch(`/api/banquets/${id}/settlement`),
    ]);
    setEvent(await evRes.json());
    setStaff(await stRes.json());
    setSettlement(await setRes.json());
  }, [params.id]);

  useEffect(() => {
    if (can(PERMISSIONS.RESERVATIONS_READ)) void load();
  }, [can, load]);

  if (!can(PERMISSIONS.RESERVATIONS_READ)) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">{tc('accessDenied')}</p>
      </AppShell>
    );
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/banquets/${params.id}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'EQUIPMENT',
        description: lineDesc,
        quantity: Number(lineQty),
        unitPrice: Number(linePrice),
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('lineAdded') : data.error ?? tc('error'));
    if (res.ok) {
      setLineDesc('');
      await load();
    }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/banquets/${params.id}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: staffRole, staffName }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('staffAdded') : data.error ?? tc('error'));
    if (res.ok) {
      setStaffName('');
      await load();
    }
  }

  async function confirmEvent() {
    const res = await fetch(`/api/banquets/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('confirmed') : data.error ?? tc('error'));
    if (res.ok) await load();
  }

  const orderLines = (event?.orderLines as Array<Record<string, unknown>>) ?? [];

  return (
    <AppShell>
      <PageHeader
        title={(event?.eventName as string) ?? t('detail')}
        subtitle={event?.eventDate ? new Date(String(event.eventDate)).toLocaleDateString() : ''}
        actions={
          <div className="flex gap-2">
            <Link href="/banquets" className={SECONDARY_BUTTON_CLASS}>
              {tc('back')}
            </Link>
            {event?.status === 'DRAFT' && can(PERMISSIONS.RESERVATIONS_WRITE) && (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={confirmEvent}>
                {t('confirm')}
              </button>
            )}
          </div>
        }
      />
      <StatusMessage>{msg}</StatusMessage>

      <div className="mb-4 flex gap-2 border-b border-[#ECF0F1]">
        {(['lines', 'resources', 'staff', 'settlement'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-2 text-sm ${tab === key ? 'border-b-2 border-[#3498DB] font-semibold' : 'text-[#7F8C8D]'}`}
            onClick={() => setTab(key)}
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'lines' && (
        <PageSection>
          <table className="mb-4 w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[#7F8C8D]">
                <th className="py-2">{t('lineDescription')}</th>
                <th className="py-2">{t('lineQty')}</th>
                <th className="py-2">{t('linePrice')}</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((l) => (
                <tr key={String(l.id)} className="border-b">
                  <td className="py-2">{String(l.description)}</td>
                  <td className="py-2">{String(l.quantity)}</td>
                  <td className="py-2">{String(l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {event?.status === 'DRAFT' && (
            <form onSubmit={addLine} className={`${FORM_STACK_CLASS} max-w-md`}>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('lineDescription')}</label>
                <input className={MODAL_INPUT_CLASS} value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{t('lineQty')}</label>
                  <input type="number" className={MODAL_INPUT_CLASS} value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                </div>
                <div className={FORM_FIELD_GROUP_CLASS}>
                  <label className={MODAL_FIELD_LABEL_CLASS}>{t('linePrice')}</label>
                  <input type="number" className={MODAL_INPUT_CLASS} value={linePrice} onChange={(e) => setLinePrice(e.target.value)} />
                </div>
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {t('addLine')}
              </button>
            </form>
          )}
        </PageSection>
      )}

      {tab === 'resources' && (
        <PageSection>
          <p className="text-sm text-[#7F8C8D]">{t('resourcesHint')}</p>
          <Link href="/banquets/calendar" className="mt-3 inline-block text-sm text-[#3498DB] underline">
            {t('openCalendar')}
          </Link>
          <ul className="mt-4 space-y-2 text-sm">
            {((event?.resourceBookings as Array<{ id: string; label?: string | null; startAt: string; saloon?: { name: string } | null }>) ?? []).map((b) => (
              <li key={b.id}>
                {b.label ?? b.saloon?.name ?? 'Resource'} —{' '}
                {new Date(b.startAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {tab === 'staff' && (
        <PageSection>
          <ul className="mb-4 space-y-2 text-sm">
            {staff.map((s) => (
              <li key={String(s.id)}>
                {String(s.role)} — {String(s.staffName)} ({String(s.status)})
              </li>
            ))}
          </ul>
          {event?.status === 'DRAFT' && (
            <form onSubmit={addStaff} className={`${FORM_STACK_CLASS} max-w-md`}>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('staffRole')}</label>
                <input className={MODAL_INPUT_CLASS} value={staffRole} onChange={(e) => setStaffRole(e.target.value)} />
              </div>
              <div className={FORM_FIELD_GROUP_CLASS}>
                <label className={MODAL_FIELD_LABEL_CLASS}>{t('staffName')}</label>
                <input className={MODAL_INPUT_CLASS} value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
              </div>
              <button type="submit" className={PRIMARY_BUTTON_CLASS}>
                {t('addStaff')}
              </button>
            </form>
          )}
        </PageSection>
      )}

      {tab === 'settlement' && settlement && (
        <PageSection>
          <dl className="grid max-w-md grid-cols-2 gap-3 text-sm">
            <dt className="text-[#7F8C8D]">{t('plannedRevenue')}</dt>
            <dd>{String(settlement.plannedRevenue)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('actualRevenue')}</dt>
            <dd>{String(settlement.actualRevenue)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('variance')}</dt>
            <dd>{String(settlement.variance)} AZN</dd>
            <dt className="text-[#7F8C8D]">{t('posPolicy')}</dt>
            <dd>{String(settlement.extrasPolicy)}</dd>
          </dl>
        </PageSection>
      )}
    </AppShell>
  );
}
