'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type PricingPolicy = {
  occupancyPricingEnabled: boolean;
  loadBasedPricingEnabled: boolean;
  childAbsolutePricingEnabled: boolean;
};

export default function PricingPolicyPage() {
  const { can } = useAuth();
  const t = useTranslations('pricingPolicy');
  const tc = useTranslations('common');
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [policy, setPolicy] = useState<PricingPolicy | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pricing-policy');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setPolicy({
        occupancyPricingEnabled: Boolean(data.occupancyPricingEnabled),
        loadBasedPricingEnabled: Boolean(data.loadBasedPricingEnabled),
        childAbsolutePricingEnabled: Boolean(data.childAbsolutePricingEnabled),
      });
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!policy || !canWrite) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/pricing-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      setPolicy({
        occupancyPricingEnabled: Boolean(data.occupancyPricingEnabled),
        loadBasedPricingEnabled: Boolean(data.loadBasedPricingEnabled),
        childAbsolutePricingEnabled: Boolean(data.childAbsolutePricingEnabled),
      });
      showSuccess(t('saved'));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: keyof PricingPolicy) {
    if (!policy) return;
    setPolicy({ ...policy, [key]: !policy[key] });
  }

  return (
    <div className="p-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {!policy ? (
        <p className="text-sm text-[#7F8C8D]">{tc('loading')}</p>
      ) : (
        <section className={`${CARD_CONTAINER_CLASS} max-w-2xl space-y-4 p-4`}>
          <label className="flex items-start gap-3 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
              checked={policy.occupancyPricingEnabled}
              disabled={!canWrite}
              onChange={() => toggle('occupancyPricingEnabled')}
            />
            <span>
              <strong className="font-semibold">{t('occupancyPricing')}</strong>
              <br />
              <span className="text-[#7F8C8D]">{t('occupancyPricingHint')}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
              checked={policy.loadBasedPricingEnabled}
              disabled={!canWrite}
              onChange={() => toggle('loadBasedPricingEnabled')}
            />
            <span>
              <strong className="font-semibold">{t('loadBasedPricing')}</strong>
              <br />
              <span className="text-[#7F8C8D]">{t('loadBasedPricingHint')}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
              checked={policy.childAbsolutePricingEnabled}
              disabled={!canWrite}
              onChange={() => toggle('childAbsolutePricingEnabled')}
            />
            <span>
              <strong className="font-semibold">{t('childAbsolute')}</strong>
              <br />
              <span className="text-[#7F8C8D]">{t('childAbsoluteHint')}</span>
            </span>
          </label>

          {canWrite ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy}
              onClick={() => void save()}
            >
              {tc('save')}
            </button>
          ) : null}

          <div className="border-t border-[#E8EEF2] pt-3 text-[13px] text-[#34495E]">
            <p className="m-0 mb-2 font-semibold">{t('related')}</p>
            <ul className="m-0 list-disc space-y-1 pl-5">
              <li>
                <Link className="text-[#2980B9] hover:underline" href="/settings/master-data">
                  {t('linkRatePlans')}
                </Link>
              </li>
              <li>
                <Link className="text-[#2980B9] hover:underline" href="/distribution/child-matrix">
                  {t('linkChildMatrix')}
                </Link>
              </li>
              <li>
                <Link className="text-[#2980B9] hover:underline" href="/distribution/yield-rules">
                  {t('linkYieldRules')}
                </Link>
              </li>
              <li>
                <Link className="text-[#2980B9] hover:underline" href="/settings/pricing-components">
                  {t('linkComponents')}
                </Link>
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
