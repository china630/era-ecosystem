'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import {
  FieldSelect,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';

type SubModal = 'creditCard' | 'packages' | 'tasks' | 'folioRouting' | null;

type RevenueCode = { id: string; code: string; name: string };
type OverrideRow = {
  revenueCodeId: string;
  targetFolioType: 'GUEST' | 'COMPANY' | 'AGENCY';
  revenueCode?: RevenueCode;
};
type RuleRow = {
  revenueCodeId: string;
  targetFolioType: string;
  revenueCode?: RevenueCode;
};

export function useReservationSubModals(reservationId: string | null) {
  const [open, setOpen] = useState<SubModal>(null);
  return {
    openSubModal: (m: SubModal) => setOpen(m),
    subModalProps: { reservationId, open, onClose: () => setOpen(null) },
  };
}

export function ReservationCardSubModals({
  reservationId,
  open,
  onClose,
}: {
  reservationId: string | null;
  open: SubModal;
  onClose: () => void;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [revenueCodes, setRevenueCodes] = useState<RevenueCode[]>([]);
  const [folios, setFolios] = useState<Array<{ type: string; status: string }>>([]);
  const [newCodeId, setNewCodeId] = useState('');
  const [newType, setNewType] = useState<'GUEST' | 'COMPANY' | 'AGENCY'>('GUEST');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const formId = 'folio-routing-form';

  const load = useCallback(async () => {
    if (!reservationId || !open) return;
    setLoading(true);
    try {
      const path =
        open === 'creditCard'
          ? 'payment-cards'
          : open === 'packages'
            ? 'packages'
            : open === 'tasks'
              ? 'tasks'
              : 'folio-routing';
      const res = await fetch(`/api/reservations/${reservationId}/${path}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (open === 'folioRouting') {
        setOverrides(json.overrides ?? []);
        setRules(json.rules ?? []);
        setRevenueCodes(json.revenueCodes ?? []);
        setFolios(
          (json.folios ?? []).map((f: { type: string; status: string }) => ({
            type: f.type,
            status: f.status,
          })),
        );
        setRows([]);
      } else {
        setRows(Array.isArray(json) ? json : []);
        setOverrides([]);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    } finally {
      setLoading(false);
    }
  }, [reservationId, open, tc]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function addRow() {
    if (!reservationId || !open) return;
    if (open === 'creditCard') {
      const lastFour = window.prompt(t('subModal.lastFour'), '4242');
      if (!lastFour || lastFour.length !== 4) return;
      await fetch(`/api/reservations/${reservationId}/payment-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastFour, cardBrand: 'VISA' }),
      });
    } else if (open === 'packages') {
      const packageCode = window.prompt(t('subModal.packageCode'));
      const packageName = window.prompt(t('subModal.packageName'));
      const amount = window.prompt(t('subModal.amount'), '0');
      if (!packageCode || !packageName) return;
      await fetch(`/api/reservations/${reservationId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageCode, packageName, amount: Number(amount) || 0 }),
      });
    } else if (open === 'tasks') {
      const title = window.prompt(t('subModal.taskTitle'));
      if (!title) return;
      await fetch(`/api/reservations/${reservationId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    }
    showSuccess(tc('success'));
    await load();
  }

  function addOverride() {
    if (!newCodeId) return;
    setOverrides((prev) => {
      const without = prev.filter((o) => o.revenueCodeId !== newCodeId);
      const code = revenueCodes.find((c) => c.id === newCodeId);
      return [...without, { revenueCodeId: newCodeId, targetFolioType: newType, revenueCode: code }];
    });
    setNewCodeId('');
  }

  function removeOverride(revenueCodeId: string) {
    setOverrides((prev) => prev.filter((o) => o.revenueCodeId !== revenueCodeId));
  }

  async function saveRouting(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/folio-routing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides: overrides.map((o) => ({
            revenueCodeId: o.revenueCodeId,
            targetFolioType: o.targetFolioType,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('error'));
        return;
      }
      setOverrides(json.overrides ?? []);
      showSuccess(t('subModal.routingSaved'));
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Exclude<SubModal, null>, string> = {
    creditCard: t('bottom.creditCard'),
    packages: t('bottom.packages'),
    tasks: t('bottom.tasks', { count: rows.length }),
    folioRouting: t('bottom.folioRouting'),
  };

  if (!open || !reservationId) return null;

  return (
    <EraModal
      open
      title={titles[open]}
      onClose={onClose}
      maxWidthClass="max-w-lg w-full"
      footer={
        open === 'folioRouting' ? (
          <EraModalFooter
            formId={formId}
            onCancel={onClose}
            busy={busy}
            submitLabel={tc('save')}
          />
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      ) : open === 'folioRouting' ? (
        <form id={formId} className="space-y-3 text-[13px]" onSubmit={(e) => void saveRouting(e)}>
          <p className="m-0 text-[#7F8C8D]">{t('subModal.routingHint')}</p>
          <p className="m-0 font-semibold text-[#34495E]">{t('subModal.stayOverrides')}</p>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[#7F8C8D]">
                <th className="pb-1">{t('subModal.revenueCode')}</th>
                <th className="pb-1">{t('subModal.targetFolio')}</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.revenueCodeId}>
                  <td className="py-1">
                    {o.revenueCode?.code ?? o.revenueCodeId} — {o.revenueCode?.name ?? ''}
                  </td>
                  <td className="py-1">{o.targetFolioType}</td>
                  <td className="py-1">
                    <button
                      type="button"
                      className="text-[#C0392B] hover:underline"
                      onClick={() => removeOverride(o.revenueCodeId)}
                    >
                      {tc('remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-end gap-2">
            <FieldSelect
              label={t('subModal.revenueCode')}
              preset="select"
              value={newCodeId}
              onChange={(e) => setNewCodeId(e.target.value)}
            >
              <option value="">{tc('select')}</option>
              {revenueCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={t('subModal.targetFolio')}
              preset="select"
              value={newType}
              onChange={(e) => setNewType(e.target.value as typeof newType)}
            >
              <option value="GUEST">GUEST</option>
              <option value="COMPANY">COMPANY</option>
              <option value="AGENCY">AGENCY</option>
            </FieldSelect>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={addOverride}>
              {tc('add')}
            </button>
          </div>
          <p className="m-0 font-semibold text-[#34495E]">{t('subModal.propertyRules')}</p>
          <ul className="m-0 list-disc pl-5 text-[12px] text-[#7F8C8D]">
            {rules.map((r) => (
              <li key={r.revenueCodeId}>
                {r.revenueCode?.code ?? r.revenueCodeId} → {r.targetFolioType}
              </li>
            ))}
          </ul>
          <p className="m-0 font-semibold text-[#34495E]">{t('subModal.openFolios')}</p>
          <p className="m-0 text-[12px] text-[#7F8C8D]">
            {folios.map((f) => `${f.type} (${f.status})`).join(', ') || '—'}
          </p>
        </form>
      ) : (
        <>
          <HotelDataGrid
            rows={rows}
            columns={
              open === 'creditCard'
                ? [
                    { key: 'cardBrand', header: t('subModal.brand') },
                    { key: 'lastFour', header: t('subModal.lastFour') },
                    { key: 'holderName', header: t('subModal.holder') },
                  ]
                : open === 'packages'
                  ? [
                      { key: 'packageCode', header: t('subModal.packageCode') },
                      { key: 'packageName', header: t('subModal.packageName') },
                      { key: 'amount', header: t('amount') },
                    ]
                  : [
                      { key: 'title', header: t('subModal.taskTitle') },
                      { key: 'status', header: t('subModal.status') },
                    ]
            }
            rowKey={(r) => String(r.id)}
            emptyMessage={tc('empty')}
          />
          <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-3`} onClick={() => void addRow()}>
            {tc('add')}
          </button>
        </>
      )}
    </EraModal>
  );
}
