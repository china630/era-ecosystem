'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  FieldSelect,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type BarPlan = { id: string; code: string; name: string };
type RoomType = { id: string; code: string; name: string };
type BarRate = {
  id: string;
  roomTypeId: string;
  roomTypeCode: string;
  date: string;
  amount: number;
};

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export default function BarCalendarPage() {
  const { can } = useAuth();
  const t = useTranslations('barCalendar');
  const tc = useTranslations('common');
  const [plans, setPlans] = useState<BarPlan[]>([]);
  const [ratePlanId, setRatePlanId] = useState('');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rates, setRates] = useState<BarRate[]>([]);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [fillRoomTypeId, setFillRoomTypeId] = useState('');
  const [fillAmount, setFillAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [recommended, setRecommended] = useState<{
    extraAdultBb: number;
    extraAdultFb: number;
    serviceFee: number;
    breakfast: number;
    lunch: number;
    dinner: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ from, to });
      if (ratePlanId) q.set('ratePlanId', ratePlanId);
      const [barRes, compRes] = await Promise.all([
        fetch(`/api/master/bar-rates?${q}`),
        fetch('/api/admin/pricing-components'),
      ]);
      const data = await barRes.json();
      if (!barRes.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      const nextPlans: BarPlan[] = data.plans ?? [];
      setPlans(nextPlans);
      setRoomTypes(data.roomTypes ?? []);
      setRates(data.rates ?? []);
      if (!ratePlanId && data.ratePlanId) setRatePlanId(data.ratePlanId);
      if (!fillRoomTypeId && data.roomTypes?.[0]?.id) {
        setFillRoomTypeId(data.roomTypes[0].id);
      }
      if (compRes.ok) {
        const comp = await compRes.json();
        if (comp.recommended) setRecommended(comp.recommended);
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [from, to, ratePlanId, fillRoomTypeId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = useMemo(() => eachDate(from, to), [from, to]);

  const cellMap = useMemo(() => {
    const m = new Map<string, BarRate>();
    for (const r of rates) m.set(`${r.roomTypeId}|${r.date}`, r);
    return m;
  }, [rates]);

  async function saveExisting(id: string, amount: string) {
    try {
      const res = await fetch(`/api/master/bar-rates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      if (res.ok) showSuccess(tc('saved'));
      else showApiError(await res.json().catch(() => ({})), tc('failed'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  async function saveOrCreate(roomTypeId: string, date: string, amount: string) {
    const n = parseFloat(amount);
    if (!ratePlanId || !Number.isFinite(n) || n <= 0) return;
    const existing = cellMap.get(`${roomTypeId}|${date}`);
    if (existing) {
      await saveExisting(existing.id, amount);
      return;
    }
    try {
      const res = await fetch('/api/master/bar-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratePlanId,
          roomTypeId,
          from: date,
          to: date,
          amount: n,
        }),
      });
      if (res.ok) showSuccess(tc('saved'));
      else showApiError(await res.json().catch(() => ({})), tc('failed'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  async function bulkFill() {
    if (!ratePlanId || !fillRoomTypeId || !fillAmount) return;
    setBusy(true);
    try {
      const res = await fetch('/api/master/bar-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratePlanId,
          roomTypeId: fillRoomTypeId,
          from,
          to,
          amount: parseFloat(fillAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('bulkFilled', { count: data.upserted ?? 0 }));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        leading={
          <Link
            href="/settings/master-data"
            className="text-[13px] text-[#2980B9] hover:underline"
          >
            {t('masterDataLink')}
          </Link>
        }
      />

      {recommended ? (
        <p className={`${CARD_CONTAINER_CLASS} mb-3 p-3 text-[13px] text-[#34495E]`}>
          {t('recommendedMin', {
            bb: recommended.extraAdultBb.toFixed(2),
            fb: recommended.extraAdultFb.toFixed(2),
            fee: recommended.serviceFee.toFixed(2),
            meals: (
              recommended.breakfast +
              recommended.lunch +
              recommended.dinner
            ).toFixed(2),
          })}
        </p>
      ) : null}

      {plans.length === 0 ? (
        <p className={`${CARD_CONTAINER_CLASS} p-4 text-[13px] text-[#7F8C8D]`}>
          {t('noBarPlans')}
        </p>
      ) : (
        <div className={TAB_STRIP_CLASS}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                p.id === ratePlanId ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS
              }
              onClick={() => setRatePlanId(p.id)}
            >
              {p.code}
              <span className="ml-1 font-normal text-[#7F8C8D]">· {p.name}</span>
            </button>
          ))}
        </div>
      )}

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          const today = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setUTCDate(end.getUTCDate() + 14);
          setFrom(today);
          setTo(end.toISOString().slice(0, 10));
        }}
        actionsExtra={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {t('refresh')}
          </button>
        }
      >
        <DatePicker
          label={tc('from')}
          value={from}
          onChange={setFrom}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
        <DatePicker
          label={tc('to')}
          value={to}
          onChange={setTo}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-3 p-3`}>
        <FieldSelect
          label={t('fillRoomType')}
          preset="select"
          value={fillRoomTypeId}
          onChange={(e) => setFillRoomTypeId(e.target.value)}
        >
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.code} — {rt.name}
            </option>
          ))}
        </FieldSelect>
        <Field
          label={t('fillAmount')}
          preset="amount"
          type="number"
          min={0}
          step="0.01"
          value={fillAmount}
          onChange={(e) => setFillAmount(e.target.value)}
        />
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || !ratePlanId || !fillAmount}
          onClick={() => void bulkFill()}
        >
          {t('fillRange')}
        </button>
        <p className="basis-full text-[12px] text-[#7F8C8D]">{t('fillHint')}</p>
      </section>

      <div className="overflow-x-auto rounded-lg border border-[#D5DADF]">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="p-2 text-left">{t('roomType')}</th>
              {dates.map((d) => (
                <th key={d} className="whitespace-nowrap p-2 text-right">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.length === 0 ? (
              <tr>
                <td className="p-3 text-[#7F8C8D]" colSpan={dates.length + 1}>
                  {t('noRoomTypes')}
                </td>
              </tr>
            ) : (
              roomTypes.map((rt) => (
                <tr key={rt.id} className="border-t border-[#ECEFF1]">
                  <td className="p-2 font-medium">
                    {rt.code}
                    <span className="ml-1 font-normal text-[#7F8C8D]">{rt.name}</span>
                  </td>
                  {dates.map((d) => {
                    const cell = cellMap.get(`${rt.id}|${d}`);
                    return (
                      <td key={d} className="p-1 text-right">
                        <input
                          type="number"
                          className="w-16 rounded border border-[#D5DADF] px-1 py-0.5 text-right"
                          defaultValue={cell?.amount ?? ''}
                          placeholder="—"
                          key={`${rt.id}|${d}|${cell?.amount ?? ''}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v) return;
                            void saveOrCreate(rt.id, d, v);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
