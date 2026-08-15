'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  Field,
  FieldRow,
  FieldSelect,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Plan = {
  id: string;
  code: string;
  name: string;
  pricePerNight: number | string;
  medicalFlag: boolean;
};

type Version = {
  id: string;
  sellPrice: number | string;
  costFloor: number | string | null;
  occupancy: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

export default function PackagePricesPage() {
  const { can } = useAuth();
  const t = useTranslations('packagePrices');
  const tc = useTranslations('common');
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [costFloor, setCostFloor] = useState('');
  const [occupancy, setOccupancy] = useState('1');
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState('');
  const formId = 'pkg-sell-version-form';

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/master/rate-plans');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      const list: Plan[] = (Array.isArray(data) ? data : []).filter((p: Plan) => p.medicalFlag);
      setPlans(list);
      if (!planId && list[0]) setPlanId(list[0].id);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [planId, tc]);

  const loadVersions = useCallback(async () => {
    if (!planId) {
      setVersions([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/rate-plans/${planId}/sell-versions`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setVersions(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [planId, tc]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rate-plans/${planId}/sell-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellPrice: Number(sellPrice),
          costFloor: costFloor.trim() === '' ? null : Number(costFloor),
          occupancy: Number(occupancy),
          effectiveFrom,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('versionCreated'));
      setModalOpen(false);
      setSellPrice('');
      setCostFloor('');
      setNote('');
      await loadVersions();
      await loadPlans();
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        leading={
          <Link className="text-[13px] text-[#2980B9] hover:underline" href="/settings/pricing-policy">
            {t('policyLink')}
          </Link>
        }
      />

      <section className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <FieldSelect
          label={t('package')}
          preset="select"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name} ({p.pricePerNight})
            </option>
          ))}
        </FieldSelect>
        {canWrite ? (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            {t('addVersion')}
          </button>
        ) : null}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('occupancy')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('sellPrice')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('costFloor')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('effectiveFrom')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('effectiveTo')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('note')}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{v.occupancy}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{v.sellPrice}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{v.costFloor ?? '—'}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {String(v.effectiveFrom).slice(0, 10)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {v.effectiveTo ? String(v.effectiveTo).slice(0, 10) : '—'}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{v.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={t('addVersion')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={tc('save')}
          />
        }
      >
        <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => void save(e)}>
          <FieldRow cols={2}>
            <Field
              label={t('sellPrice')}
              preset="amount"
              type="number"
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              required
            />
            <Field
              label={t('costFloor')}
              preset="amount"
              type="number"
              step="0.01"
              value={costFloor}
              onChange={(e) => setCostFloor(e.target.value)}
            />
          </FieldRow>
          <FieldRow cols={2}>
            <Field
              label={t('occupancy')}
              preset="count"
              type="number"
              min={1}
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value)}
              required
            />
            <DatePicker
              label={t('effectiveFrom')}
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              placeholder={tc('datePlaceholder')}
              preset="date"
            />
          </FieldRow>
          <Field
            label={t('note')}
            preset="longText"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </form>
      </EraModal>
    </div>
  );
}
