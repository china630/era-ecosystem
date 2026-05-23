'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Alert {
  id: string;
  message: string;
  temperature: number | null;
  guest: { fullName: string };
}

interface Guest {
  id: string;
  fullName: string;
}

interface Reservation {
  id: string;
  guest: Guest;
  status: string;
}

export default function MedicalPage() {
  const { can } = useAuth();
  const t = useTranslations('medical');
  const tc = useTranslations('common');
  const tRes = useTranslations('reservationStatus');
  const defaultAlert = t('defaultAlert');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guestId, setGuestId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [alertMsg, setAlertMsg] = useState(defaultAlert);
  const [orderType, setOrderType] = useState('LAB');
  const [msg, setMsg] = useState<string | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [aRes, rRes] = await Promise.all([
      fetch('/api/medical/alerts'),
      fetch('/api/reservations?status=IN_HOUSE'),
    ]);
    if (aRes.ok) setAlerts(await aRes.json());
    if (rRes.ok) {
      const r = await rRes.json();
      setReservations(r);
      setReservationId((prev) => prev || r[0]?.id || '');
      setGuestId((prev) => prev || r[0]?.guest?.id || '');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alertFormId = 'create-alert-form';

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/medical/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, reservationId: reservationId || undefined, message: alertMsg, temperature: 38.2 }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('alertCreated') : data.error);
    if (res.ok) {
      setAlertModalOpen(false);
      setAlertMsg(defaultAlert);
    }
    await load();
  }

  async function createOrder() {
    const res = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, orderType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(t('orderCreated', { id: data.id }));
    const labRes = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: data.id,
        testName: 'CBC',
        resultValue: '5.2',
        flag: 'NORMAL',
      }),
    });
    const labData = await labRes.json();
    setMsg(labRes.ok ? t('orderLabResult', { test: labData.testName }) : labData.error);
    await load();
  }

  async function postProcedure() {
    const res = await fetch('/api/medical/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        code: 'MED-PROC',
        name: t('procedureName'),
        amount: 50,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('procedurePosted') : data.error);
  }

  if (!can(PERMISSIONS.MEDICAL_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-3xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionMedical')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('alerts')}</h2>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setAlertModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('createAlert')}
          </button>
        </div>
        <ul className="space-y-1 text-[13px] text-[#34495E]">
          {alerts.map((a) => (
            <li key={a.id}>
              {a.guest.fullName}: {a.message}
              {a.temperature != null && ` (${a.temperature}°C)`}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('orderLab')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={MODAL_INPUT_CLASS}
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
          >
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.guest.fullName} ({tRes(r.status as 'IN_HOUSE')})
              </option>
            ))}
          </select>
          <input className={MODAL_INPUT_CLASS} value={orderType} onChange={(e) => setOrderType(e.target.value)} />
          <button type="button" onClick={createOrder} className={PRIMARY_BUTTON_CLASS}>
            {t('createOrderLab')}
          </button>
        </div>
      </PageSection>

      <PageSection>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('procedureFolio')}</h2>
        <button type="button" onClick={postProcedure} className={PRIMARY_BUTTON_CLASS}>
          {t('postProcedure')}
        </button>
      </PageSection>

      <EraModal
        open={alertModalOpen}
        title={t('createAlert')}
        onClose={() => setAlertModalOpen(false)}
        footer={
          <EraModalFooter
            formId={alertFormId}
            onCancel={() => setAlertModalOpen(false)}
            busy={busy}
            submitLabel={t('createAlert')}
          />
        }
      >
        <form id={alertFormId} onSubmit={createAlert} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="alert-guest">
              {tc('guest')}
            </label>
            <select
              id="alert-guest"
              className={MODAL_INPUT_CLASS}
              value={guestId}
              onChange={(e) => {
                setGuestId(e.target.value);
                const r = reservations.find((x) => x.guest.id === e.target.value);
                if (r) setReservationId(r.id);
              }}
            >
              {reservations.map((r) => (
                <option key={r.guest.id} value={r.guest.id}>
                  {r.guest.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="alert-msg">
              {tc('message')}
            </label>
            <input
              id="alert-msg"
              className={MODAL_INPUT_CLASS}
              value={alertMsg}
              onChange={(e) => setAlertMsg(e.target.value)}
            />
          </div>
        </form>
      </EraModal>
    </AppShell>
  );
}
