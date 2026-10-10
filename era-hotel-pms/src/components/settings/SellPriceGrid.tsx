'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  CatalogField,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { seasonDateKey } from '@/lib/pricing/price-season';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Plan = {
  id: string;
  code: string;
  name: string;
  medicalFlag: boolean;
};

type RoomTypeRow = {
  id: string;
  code: string;
  name: string;
  adultCapacity?: number;
};

type MealRow = { id: string; code: string; name: string };

type SeasonRow = {
  id: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

type Version = {
  id: string;
  sellPrice: number | string;
  costFloor: number | string | null;
  occupancy: number;
  roomTypeId: string | null;
  mealPlanId: string | null;
  seasonId: string | null;
  note: string | null;
};

const DAILY_PLAN_CODES = new Set(['DAILY RATES', 'WALKIN']);
const DAILY_MEALS = new Set(['BB', 'FB']);

export function SellPriceGrid({ mode }: { mode: 'package' | 'daily' }) {
  const { can } = useAuth();
  const t = useTranslations('packagePrices');
  const tc = useTranslations('common');
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [planId, setPlanId] = useState('');
  const [mealId, setMealId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [costFloor, setCostFloor] = useState('');
  const [occupancy, setOccupancy] = useState('1');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [note, setNote] = useState('');
  const formId = 'pkg-sell-version-form';

  const loadPlans = useCallback(async () => {
    try {
      const [planRes, typeRes, mealRes, seasonRes] = await Promise.all([
        fetch('/api/master/rate-plans'),
        fetch('/api/master/room-types'),
        fetch('/api/master/meal-plans'),
        fetch('/api/admin/price-seasons'),
      ]);
      const planData = await planRes.json();
      const typeData = await typeRes.json();
      const mealData = await mealRes.json();
      const seasonData = await seasonRes.json();
      if (!planRes.ok) {
        showApiError(planData, tc('loadError'));
        return;
      }
      const allPlans: Plan[] = Array.isArray(planData) ? planData : [];
      const list =
        mode === 'package'
          ? allPlans.filter((p) => p.medicalFlag)
          : allPlans.filter((p) => DAILY_PLAN_CODES.has(p.code.toUpperCase()));
      setPlans(list);
      if (!planId) {
        const preferred =
          mode === 'daily'
            ? list.find((p) => p.code.toUpperCase() === 'DAILY RATES') ?? list[0]
            : list[0];
        if (preferred) setPlanId(preferred.id);
      }
      const types: RoomTypeRow[] = Array.isArray(typeData) ? typeData : [];
      setRoomTypes(types.filter((row) => (row as { active?: boolean }).active !== false));
      const mealList: MealRow[] = (Array.isArray(mealData) ? mealData : []).filter((m: MealRow) =>
        mode === 'daily' ? DAILY_MEALS.has(m.code.toUpperCase()) : true,
      );
      setMeals(mealList);
      if (!mealId) {
        const preferredCode = mode === 'daily' ? 'BB' : 'FB';
        const hit =
          mealList.find((m) => m.code.toUpperCase() === preferredCode) ?? mealList[0];
        if (hit) setMealId(hit.id);
      }
      const seasonList: SeasonRow[] = (Array.isArray(seasonData) ? seasonData : []).map(
        (row: SeasonRow) => ({
          ...row,
          startsOn: seasonDateKey(row.startsOn),
          endsOn: seasonDateKey(row.endsOn),
        }),
      );
      setSeasons(seasonList);
      if (!seasonId && seasonList[0]) setSeasonId(seasonList[0].id);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [planId, mealId, seasonId, mode, tc]);

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

  const maxOcc = useMemo(
    () => Math.max(1, ...roomTypes.map((rt) => rt.adultCapacity ?? 2)),
    [roomTypes],
  );

  const season = seasons.find((row) => row.id === seasonId);

  function cellAt(typeId: string, occ: number): Version | undefined {
    return versions.find(
      (v) =>
        v.roomTypeId === typeId &&
        v.mealPlanId === mealId &&
        v.occupancy === occ &&
        v.seasonId === seasonId,
    );
  }

  function openCell(typeId: string, occ: number) {
    const existing = cellAt(typeId, occ);
    setRoomTypeId(typeId);
    setOccupancy(String(occ));
    setSellPrice(existing ? String(existing.sellPrice) : '');
    setCostFloor(existing?.costFloor != null ? String(existing.costFloor) : '');
    setNote(existing?.note ?? '');
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!planId || !roomTypeId || !mealId || !season) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rate-plans/${planId}/sell-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellPrice: Number(sellPrice),
          costFloor: costFloor.trim() === '' ? null : Number(costFloor),
          occupancy: Number(occupancy),
          roomTypeId,
          mealPlanId: mealId,
          seasonId: season.id,
          effectiveFrom: season.startsOn,
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
    } catch (err) {
      showApiError({ error: err instanceof Error ? err.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  const plan = plans.find((row) => row.id === planId);
  const room = roomTypes.find((row) => row.id === roomTypeId);
  const meal = meals.find((row) => row.id === mealId);
  const modalTitle = [
    plan ? `${plan.code}` : null,
    room?.code,
    occupancy,
    meal?.code,
    season?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="p-4">
      <PageHeader
        title={mode === 'daily' ? t('dailyTitle') : t('title')}
        subtitle={mode === 'daily' ? t('dailySubtitle') : t('subtitle')}
        leading={
          <Link className="text-[13px] text-[#2980B9] hover:underline" href="/settings/seasons">
            {t('seasonsLink')}
          </Link>
        }
      />

      <section className={`${CARD_CONTAINER_CLASS} mb-4 space-y-3 p-4`}>
        <FieldRow cols={3}>
          <CatalogField
            kind="ENTITY_REF"
            label={mode === 'daily' ? t('dailyPlan') : t('package')}
            value={planId}
            onChange={(v) => setPlanId(String(v ?? ''))}
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.code} — ${p.name}`,
            }))}
            emptyLabel={null}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('meal')}
            value={mealId}
            onChange={(v) => setMealId(String(v ?? ''))}
            options={meals.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
            emptyLabel={null}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('season')}
            value={seasonId}
            onChange={(v) => setSeasonId(String(v ?? ''))}
            options={seasons.map((s) => ({
              value: s.id,
              label: `${s.name} (${seasonDateKey(s.startsOn)} – ${seasonDateKey(s.endsOn)})`,
            }))}
            emptyLabel={null}
          />
        </FieldRow>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                {Array.from({ length: maxOcc }, (_, i) => (
                  <th key={i + 1} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{rt.code}</td>
                  {Array.from({ length: maxOcc }, (_, i) => {
                    const occ = i + 1;
                    const ceiling = rt.adultCapacity ?? 2;
                    if (occ > ceiling) {
                      return (
                        <td key={occ} className={DATA_TABLE_TD_CLASS}>
                          —
                        </td>
                      );
                    }
                    const cell = cellAt(rt.id, occ);
                    return (
                      <td key={occ} className={DATA_TABLE_TD_CLASS}>
                        {canWrite && season ? (
                          <button
                            type="button"
                            className="text-[#2980B9] hover:underline"
                            onClick={() => openCell(rt.id, occ)}
                          >
                            {cell ? String(cell.sellPrice) : t('notSold')}
                          </button>
                        ) : (
                          <span>{cell ? String(cell.sellPrice) : t('notSold')}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={modalOpen}
        title={modalTitle || t('addVersion')}
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
              label={t('roomType')}
              preset="shortText"
              value={room?.code ?? ''}
              readOnly
            />
            <Field
              label={t('occupancy')}
              preset="count"
              type="number"
              min={1}
              value={occupancy}
              readOnly
            />
          </FieldRow>
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
