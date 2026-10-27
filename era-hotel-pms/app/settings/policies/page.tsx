'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  MODAL_CHECKBOX_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPackEligibleReports } from '@/lib/reports/catalog';
import { LetterheadSection } from '@/components/settings/LetterheadSection';

type PricingPolicy = {
  occupancyPricingEnabled: boolean;
  loadBasedPricingEnabled: boolean;
  childAbsolutePricingEnabled: boolean;
  agencyPortalAutoConfirm: boolean;
  stopIfZeroNightPrice: boolean;
  autoNoShow: boolean;
  stopIfGuestFolioBalance: boolean;
  autoExtendUndeparted: boolean;
  checkCheckedOutFolios: boolean;
  cancelRoomChangePlans: boolean;
};

type TourOpsPolicy = {
  chargeMode: 'CHARGE_ON_BOARDING' | 'CHARGE_ON_ADD';
  boardingCloseMode: 'MANUAL' | 'AUTO_CUTOFF';
  autoCutoffMinutesBeforePickup: number | null;
  allowOverbook: boolean;
  dropUnboardedOnClose: boolean;
};

export default function PoliciesPage() {
  const t = useTranslations('policies');
  const tn = useTranslations('operations');
  const th = useTranslations('housekeeping');
  const tp = useTranslations('pricingPolicy');
  const tt = useTranslations('tourOpsPolicy');
  const tr = useTranslations();
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canHk = can(PERMISSIONS.HOUSEKEEPING_MANAGE);
  const canPrice = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const canPack = can(PERMISSIONS.USERS_MANAGE);
  const canTours = can(PERMISSIONS.MASTER_DATA_MANAGE);

  const [linen, setLinen] = useState(3);
  const [deep, setDeep] = useState(5);
  const [policy, setPolicy] = useState<PricingPolicy | null>(null);
  const [tourOps, setTourOps] = useState<TourOpsPolicy | null>(null);
  const [pack, setPack] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'hk' | 'price' | 'pack' | 'tours' | null>(null);
  const eligible = getPackEligibleReports();

  const load = useCallback(async () => {
    if (canHk) {
      const hkRes = await fetch('/api/housekeeping/policy');
      if (hkRes.ok) {
        const json = await hkRes.json();
        setLinen(json.linenEveryNights ?? 3);
        setDeep(json.deepEveryNights ?? 5);
      }
    }
    if (canPrice) {
      const priceRes = await fetch('/api/admin/pricing-policy');
      if (priceRes.ok) {
        const data = await priceRes.json();
        setPolicy({
          occupancyPricingEnabled: Boolean(data.occupancyPricingEnabled),
          loadBasedPricingEnabled: Boolean(data.loadBasedPricingEnabled),
          childAbsolutePricingEnabled: Boolean(data.childAbsolutePricingEnabled),
          agencyPortalAutoConfirm: Boolean(data.agencyPortalAutoConfirm),
          stopIfZeroNightPrice: data.stopIfZeroNightPrice !== false,
          autoNoShow: Boolean(data.autoNoShow),
          stopIfGuestFolioBalance: data.stopIfGuestFolioBalance !== false,
          autoExtendUndeparted: data.autoExtendUndeparted !== false,
          checkCheckedOutFolios: data.checkCheckedOutFolios !== false,
          cancelRoomChangePlans: data.cancelRoomChangePlans !== false,
        });
      }
    }
    if (canTours) {
      const tourRes = await fetch('/api/tours/policy');
      if (tourRes.ok) {
        const data = await tourRes.json();
        setTourOps({
          chargeMode: data.chargeMode === 'CHARGE_ON_ADD' ? 'CHARGE_ON_ADD' : 'CHARGE_ON_BOARDING',
          boardingCloseMode: data.boardingCloseMode === 'AUTO_CUTOFF' ? 'AUTO_CUTOFF' : 'MANUAL',
          autoCutoffMinutesBeforePickup: data.autoCutoffMinutesBeforePickup ?? null,
          allowOverbook: data.allowOverbook !== false,
          dropUnboardedOnClose: data.dropUnboardedOnClose !== false,
        });
      }
    }
    if (canPack) {
      const packRes = await fetch('/api/admin/report-pack');
      if (packRes.ok) {
        const data = (await packRes.json()) as { reportIds?: string[] };
        setPack(new Set(data.reportIds ?? []));
      }
    }
  }, [canHk, canPrice, canPack, canTours]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHk() {
    setBusy('hk');
    try {
      const res = await fetch('/api/housekeeping/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linenEveryNights: linen, deepEveryNights: deep }),
      });
      if (!res.ok) showApiError(await res.json(), tc('failed'));
      else showSuccess(tc('saved'));
    } finally {
      setBusy(null);
    }
  }

  async function savePrice() {
    if (!policy) return;
    setBusy('price');
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
        agencyPortalAutoConfirm: Boolean(data.agencyPortalAutoConfirm),
        stopIfZeroNightPrice: data.stopIfZeroNightPrice !== false,
        autoNoShow: Boolean(data.autoNoShow),
        stopIfGuestFolioBalance: data.stopIfGuestFolioBalance !== false,
        autoExtendUndeparted: data.autoExtendUndeparted !== false,
        checkCheckedOutFolios: data.checkCheckedOutFolios !== false,
        cancelRoomChangePlans: data.cancelRoomChangePlans !== false,
      });
      showSuccess(tp('saved'));
    } finally {
      setBusy(null);
    }
  }

  async function savePack() {
    setBusy('pack');
    try {
      const res = await fetch('/api/admin/report-pack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: [...pack] }),
      });
      if (!res.ok) showApiError(await res.json().catch(() => ({})), tc('failed'));
      else showSuccess(tc('saved'));
    } finally {
      setBusy(null);
    }
  }

  async function saveTourOps() {
    if (!tourOps) return;
    setBusy('tours');
    try {
      const res = await fetch('/api/tours/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tourOps),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc('failed'));
        return;
      }
      const data = await res.json();
      setTourOps({
        chargeMode: data.chargeMode === 'CHARGE_ON_ADD' ? 'CHARGE_ON_ADD' : 'CHARGE_ON_BOARDING',
        boardingCloseMode: data.boardingCloseMode === 'AUTO_CUTOFF' ? 'AUTO_CUTOFF' : 'MANUAL',
        autoCutoffMinutesBeforePickup: data.autoCutoffMinutesBeforePickup ?? null,
        allowOverbook: data.allowOverbook !== false,
        dropUnboardedOnClose: data.dropUnboardedOnClose !== false,
      });
      showSuccess(tc('saved'));
    } finally {
      setBusy(null);
    }
  }

  function togglePrice(key: keyof PricingPolicy) {
    if (!policy) return;
    setPolicy({ ...policy, [key]: !policy[key] });
  }

  function togglePack(id: string) {
    setPack((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const priceRows: { key: keyof PricingPolicy; title: string; hint: string }[] = policy
    ? [
        { key: 'occupancyPricingEnabled', title: tp('occupancyPricing'), hint: tp('occupancyPricingHint') },
        { key: 'loadBasedPricingEnabled', title: tp('loadBasedPricing'), hint: tp('loadBasedPricingHint') },
        { key: 'childAbsolutePricingEnabled', title: tp('childAbsolute'), hint: tp('childAbsoluteHint') },
        { key: 'agencyPortalAutoConfirm', title: tp('agencyPortalAutoConfirm'), hint: tp('agencyPortalAutoConfirmHint') },
      ]
    : [];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="flex max-w-3xl flex-col gap-4">
        {!canHk && !canPrice && !canPack && !canTours ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
        ) : null}
        {canTours && tourOps ? (
        <section id="tours" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{tt('title')}</h2>
          <p className="m-0 text-[13px] text-[#7F8C8D]">{tt('subtitle')}</p>
          <CatalogField
            kind="CLOSED_SMALL"
            label={tt('chargeMode')}
            value={tourOps.chargeMode}
            onChange={(v) =>
              setTourOps({
                ...tourOps,
                chargeMode: String(v) === 'CHARGE_ON_ADD' ? 'CHARGE_ON_ADD' : 'CHARGE_ON_BOARDING',
              })
            }
            options={[
              { value: 'CHARGE_ON_BOARDING', label: tt('chargeOnBoarding') },
              { value: 'CHARGE_ON_ADD', label: tt('chargeOnAdd') },
            ]}
          />
          <p className="m-0 text-[12px] text-[#7F8C8D]">{tt('chargeModeHint')}</p>
          <CatalogField
            kind="CLOSED_SMALL"
            label={tt('boardingCloseMode')}
            value={tourOps.boardingCloseMode}
            onChange={(v) =>
              setTourOps({
                ...tourOps,
                boardingCloseMode: String(v) === 'AUTO_CUTOFF' ? 'AUTO_CUTOFF' : 'MANUAL',
              })
            }
            options={[
              { value: 'MANUAL', label: tt('closeManual') },
              { value: 'AUTO_CUTOFF', label: tt('closeAuto') },
            ]}
          />
          {tourOps.boardingCloseMode === 'AUTO_CUTOFF' ? (
            <Field
              label={tt('autoCutoffMinutes')}
              preset="code"
              type="number"
              min={1}
              value={String(tourOps.autoCutoffMinutesBeforePickup ?? 30)}
              onChange={(e) =>
                setTourOps({
                  ...tourOps,
                  autoCutoffMinutesBeforePickup: Number(e.target.value) || null,
                })
              }
            />
          ) : null}
          <label className="flex items-start gap-3 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
              checked={tourOps.allowOverbook}
              onChange={() => setTourOps({ ...tourOps, allowOverbook: !tourOps.allowOverbook })}
            />
            <span>{tt('allowOverbook')}</span>
          </label>
          <label className="flex items-start gap-3 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
              checked={tourOps.dropUnboardedOnClose}
              onChange={() =>
                setTourOps({ ...tourOps, dropUnboardedOnClose: !tourOps.dropUnboardedOnClose })
              }
            />
            <span>{tt('dropUnboardedOnClose')}</span>
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy === 'tours'}
            onClick={() => void saveTourOps()}
          >
            {tc('save')}
          </button>
        </section>
        ) : null}
        {canHk ? (
        <section id="hk" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{th('policyTitle')}</h2>
          <p className="m-0 text-[13px] text-[#7F8C8D]">{th('policyHint')}</p>
          <label className="block text-sm text-[#34495E]">
            {th('linenEvery')}
            <input
              type="number"
              min={1}
              max={30}
              className="ml-2 rounded border border-[#D5DADF] px-2 py-1"
              value={linen}
              onChange={(e) => setLinen(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm text-[#34495E]">
            {th('deepEvery')}
            <input
              type="number"
              min={1}
              max={30}
              className="ml-2 rounded border border-[#D5DADF] px-2 py-1"
              value={deep}
              onChange={(e) => setDeep(Number(e.target.value))}
            />
          </label>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy === 'hk'} onClick={() => void saveHk()}>
            {tc('save')}
          </button>
        </section>
        ) : null}

        {canPrice ? (
        <section id="pricing" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{tp('title')}</h2>
          <p className="m-0 text-[13px] text-[#7F8C8D]">{tp('subtitle')}</p>
          {priceRows.map((row) => (
            <label key={row.key} className="flex items-start gap-3 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
                checked={Boolean(policy?.[row.key])}
                disabled={!canPrice || !policy}
                onChange={() => togglePrice(row.key)}
              />
              <span>
                <strong className="font-semibold">{row.title}</strong>
                <br />
                <span className="text-[#7F8C8D]">{row.hint}</span>
              </span>
            </label>
          ))}
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy === 'price' || !policy} onClick={() => void savePrice()}>
            {tc('save')}
          </button>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[13px]">
            <li><Link className="text-[#2980B9] hover:underline" href="/settings/bar-calendar">{tp('linkBarCalendar')}</Link></li>
            <li><Link className="text-[#2980B9] hover:underline" href="/settings/child-matrix">{tp('linkChildMatrix')}</Link></li>
            <li><Link className="text-[#2980B9] hover:underline" href="/settings/yield-rules">{tp('linkYieldRules')}</Link></li>
            <li><Link className="text-[#2980B9] hover:underline" href="/settings/pricing-components">{tp('linkComponents')}</Link></li>
          </ul>
        </section>
        ) : null}

        {canPrice ? <LetterheadSection /> : null}

        {canPrice && policy ? (
        <section id="night-audit" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{tn('nightAudit')}</h2>
          {(
            [
              ['stopIfZeroNightPrice', 'naStopZeroPrice'],
              ['autoNoShow', 'naAutoNoShow'],
              ['stopIfGuestFolioBalance', 'naStopGuestFolio'],
              ['autoExtendUndeparted', 'naAutoExtend'],
              ['checkCheckedOutFolios', 'naCheckCheckedOut'],
              ['cancelRoomChangePlans', 'naCancelRoomMoves'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-3 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={`${MODAL_CHECKBOX_CLASS} mt-0.5`}
                checked={Boolean(policy[key])}
                onChange={() => setPolicy({ ...policy, [key]: !policy[key] })}
              />
              <span>{tn(label)}</span>
            </label>
          ))}
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy === 'price'} onClick={() => void savePrice()}>
            {tc('save')}
          </button>
        </section>
        ) : null}

        {canPack ? (
        <section id="reports" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{tr('reports.nightlyPack')}</h2>
          {eligible.map((r) => (
            <label key={r.id} className="flex items-center gap-3 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                checked={pack.has(r.id)}
                onChange={() => togglePack(r.id)}
              />
              <span>{tr(r.titleKey as never)}</span>
            </label>
          ))}
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy === 'pack'} onClick={() => void savePack()}>
            {tc('save')}
          </button>
        </section>
        ) : null}
      </div>
    </>
  );
}
