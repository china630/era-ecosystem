'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  code: string;
  name: string;
  family: 'MEDICAL' | 'INFOTUR';
  active: boolean;
  ratePlanId: string | null;
  minNights: number | null;
  maxNights: number | null;
  durationDays: number | null;
  sortOrder: number;
};

export default function SanatoriumPackagesPage() {
  const t = useTranslations('sanatoriumPackages');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canPrice = can(PERMISSIONS.PRICING_ADMIN);
  const [items, setItems] = useState<Row[]>([]);
  const [activeMedical, setActiveMedical] = useState(0);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!canPrice) return;
    const res = await fetch('/api/admin/sanatorium-packages');
    if (res.status === 403) {
      setForbidden(true);
      setItems([]);
      return;
    }
    setForbidden(false);
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc('failed'));
      return;
    }
    const json = await res.json();
    setItems(Array.isArray(json.items) ? json.items : []);
    setActiveMedical(Number(json.activeMedical ?? 0));
  }, [canPrice, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncClinic() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sanatorium-packages/sync', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(json, tc('failed'));
        return;
      }
      if (!json.clinicReached) {
        showApiError({ error: t('clinicUnreachable') }, tc('failed'));
      } else {
        showSuccess(t('syncOk', { count: json.upserted ?? 0 }));
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: Row) {
    const res = await fetch(`/api/admin/sanatorium-packages/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc('failed'));
      return;
    }
    await load();
  }

  async function setFamily(row: Row, family: 'MEDICAL' | 'INFOTUR') {
    const res = await fetch(`/api/admin/sanatorium-packages/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc('failed'));
      return;
    }
    await load();
  }

  if (!canPrice) {
    return (
      <div className="p-4">
        <PageHeader title={t('title')} />
        <p className="text-sm text-[#7F8C8D]">{tc('noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {forbidden ? (
        <p className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t('moduleOff')}</p>
      ) : (
        <>
          <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-center gap-3 p-4`}>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void syncClinic()}
            >
              {t('syncFromClinic')}
            </button>
            <Link className="text-[#2980B9] underline text-sm" href="/settings/package-prices">
              {t('linkPackagePrices')}
            </Link>
            <Link className="text-[#2980B9] underline text-sm" href="/settings/policies#pricing">
              {t('linkPricingHub')}
            </Link>
            {activeMedical === 0 ? (
              <span className="text-sm text-rose-800">{t('emptyMedicalWarn')}</span>
            ) : (
              <span className="text-sm text-[#7F8C8D]">
                {t('activeMedicalCount', { count: activeMedical })}
              </span>
            )}
          </div>
          <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-0`}>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#D5DADF] bg-[#F8FAFB]">
                  <th className="px-3 py-2">{t('colCode')}</th>
                  <th className="px-3 py-2">{t('colName')}</th>
                  <th className="px-3 py-2">{t('colFamily')}</th>
                  <th className="px-3 py-2">{t('colNights')}</th>
                  <th className="px-3 py-2">{t('colActive')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[#EEF2F4]">
                    <td className="px-3 py-2 font-mono">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">
                      <CatalogField
                        kind="CLOSED_SMALL"
                        label={t('colFamily')}
                        value={row.family}
                        onChange={(v) => {
                          const next = Array.isArray(v) ? v[0] : v;
                          if (next === 'MEDICAL' || next === 'INFOTUR') void setFamily(row, next);
                        }}
                        options={[
                          { value: 'MEDICAL', label: t('familyMedical') },
                          { value: 'INFOTUR', label: t('familyInfotur') },
                        ]}
                        emptyLabel={null}
                      />
                    </td>
                    <td className="px-3 py-2 text-[#7F8C8D]">
                      {row.minNights ?? '—'} / {row.maxNights ?? '—'}
                      {row.durationDays != null ? ` (${row.durationDays})` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className={MODAL_CHECKBOX_CLASS}
                          checked={row.active}
                          onChange={() => void toggleActive(row)}
                        />
                        {row.active ? t('on') : t('off')}
                      </label>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#7F8C8D]">
                      {t('empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {tc('refresh')}
          </button>
        </>
      )}
    </div>
  );
}
