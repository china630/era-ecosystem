'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TR_CLASS,
  FieldSection,
  SECONDARY_BUTTON_CLASS,
  TEXT_DANGER_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';

type ClinicProcedure = {
  orderId: string;
  procedureName: string;
  amount: number;
  status: 'in_plan' | 'arrived' | 'no_show' | 'completed' | 'cancelled';
  folioRef: string | null;
};

type ClinicCheckout = {
  medical?: boolean;
  paid?: ClinicProcedure[];
  packageSessions?: ClinicProcedure[];
};

function sameChargeRef(stored: string | null | undefined, folioRef: string | null): boolean {
  if (!stored || !folioRef) return false;
  const norm = (value: string) => value.trim().replace(/^pay-/, '');
  return norm(stored) === norm(folioRef);
}

/** Paid clinic rows live on the folio tab: one row void, or pay / void the whole plan. */
export function ClinicPlanPanel({
  reservationId,
  charges,
  onChanged,
}: {
  reservationId: string;
  charges: Array<{ id: string; externalRef?: string | null }>;
  onChanged?: () => void;
}) {
  const t = useTranslations('folio');
  const tc = useTranslations('common');
  const tPay = useTranslations('paymentMethod');
  const [clinic, setClinic] = useState<ClinicCheckout | null>(null);
  const [method, setMethod] = useState('CASH');
  const [terminal, setTerminal] = useState('');
  const [terminals, setTerminals] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reservations/${reservationId}/clinic-checkout`);
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    setClinic((body?.data ?? body) as ClinicCheckout);
  }, [reservationId]);

  useEffect(() => {
    void load();
    void fetch('/api/fiscal/devices?kind=BANK_POS')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { devices?: { id: string; label: string }[] } | null) => {
        setTerminals(body?.devices ?? []);
      })
      .catch(() => setTerminals([]));
  }, [load]);

  if (!clinic?.medical) return null;
  const planned = (clinic.paid ?? []).filter((row) => row.status === 'in_plan');
  const plannedSum = planned.reduce((sum, row) => sum + row.amount, 0);

  async function voidCharge(id: string) {
    const res = await fetch(`/api/folios/charges/${id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: t('clinicVoid') }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => null), tc('error'));
      return;
    }
    await load();
    onChanged?.();
  }

  async function voidAll() {
    setBusy(true);
    try {
      for (const row of planned) {
        const charge = charges.find((item) => sameChargeRef(item.externalRef, row.folioRef));
        if (!charge) continue;
        const res = await fetch(`/api/folios/charges/${charge.id}/void`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: t('clinicVoidAll') }),
        });
        if (!res.ok) {
          showApiError(await res.json().catch(() => null), tc('error'));
          return;
        }
      }
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function payAll() {
    if (!(plannedSum > 0)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          paymentCategory: 'CLINIC',
          amount: Math.round(plannedSum * 100) / 100,
          paymentMethod: method,
          bankTerminalId: method === 'CARD' ? terminal || undefined : undefined,
        }),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => null), tc('error'));
        return;
      }
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldSection title={t('clinicPaidTitle')}>
      <div className="space-y-2 text-[13px]">
        <div className="flex flex-wrap items-end gap-2">
          <CatalogField
            kind="OPS_HOT"
            label={t('earlyCheckoutTender')}
            value={method}
            onChange={(v) => setMethod(String(v ?? 'CASH'))}
            options={[
              { value: 'CASH', label: tPay('CASH') },
              { value: 'CARD', label: tPay('CARD') },
            ]}
            emptyLabel={null}
          />
          {method === 'CARD' && terminals.length > 0 ? (
            <CatalogField
              kind="CLOSED_SMALL"
              label={t('bankTerminal')}
              required
              value={terminal}
              onChange={(v) => setTerminal(String(v ?? ''))}
              options={terminals.map((row) => ({ value: row.id, label: row.label }))}
              emptyLabel={t('pickTerminal')}
            />
          ) : null}
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || planned.length === 0} onClick={() => void payAll()}>
            {t('clinicPayAll', { amount: plannedSum.toFixed(2) })}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || planned.length === 0} onClick={() => void voidAll()}>
            {t('clinicVoidAll')}
          </button>
        </div>
        <table className={DATA_TABLE_CLASS}>
          <tbody>
            {(clinic.paid ?? []).map((row) => {
              const charge = charges.find((item) => sameChargeRef(item.externalRef, row.folioRef));
              return (
                <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.amount.toFixed(2)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{t(`clinicStatus_${row.status}`)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.status === 'in_plan' && charge ? (
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void voidCharge(charge.id)}>
                        {t('clinicVoid')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(clinic.packageSessions ?? []).length > 0 ? (
          <>
            <p className="m-0 font-medium">{t('clinicPackageTitle')}</p>
            <table className={DATA_TABLE_CLASS}>
              <tbody>
                {(clinic.packageSessions ?? []).map((row) => (
                  <tr key={row.orderId} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{row.procedureName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{t(`clinicStatus_${row.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        {planned.length > 0 ? <p className={`m-0 ${TEXT_DANGER_CLASS}`}>{t('clinicPaidOnFolio')}</p> : null}
      </div>
    </FieldSection>
  );
}
