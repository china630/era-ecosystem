'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import {
  CatalogField,
  DatePicker,
  EraListFilterBar,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

type Row = {
  id: string;
  housekeeper: { name: string };
  pair: { floorLow: number; floorHigh: number };
};

export default function HkRotationPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [date, setDate] = useState(() => hotelDateKey());
  const [rows, setRows] = useState<Row[]>([]);
  const [warn, setWarn] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/housekeeping/rotation?date=${date}`);
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, t('title'));
      return;
    }
    setRows(Array.isArray(json) ? json : json.assigned ?? []);
  }, [date, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rotate() {
    const res = await fetch('/api/housekeeping/rotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, shiftKind: 'E' }),
    });
    const json = await res.json();
    if (!res.ok) showApiError(json, t('title'));
    else setWarn(Boolean(json.warning));
    await load();
  }

  async function swap(e: React.FormEvent) {
    e.preventDefault();
    if (!a || !b || a === b) return;
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIdA: a, rowIdB: b }),
      });
      if (!res.ok) showApiError(await res.json(), t('title'));
      else {
        showSuccess(tc('saved'));
        setSwapOpen(false);
        setA('');
        setB('');
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const people = rows.map((r) => ({
    value: r.id,
    label: `${r.housekeeper.name} · ${r.pair.floorLow}–${r.pair.floorHigh}`,
  }));

  return (
    <>
      <PageHeader
        title={t('rotationTitle')}
        subtitle={t('rotationHint')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void rotate()}>
              {t('rotateToday')}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={rows.length < 2}
              onClick={() => {
                setA('');
                setB('');
                setSwapOpen(true);
              }}
            >
              {t('swapPairs')}
            </button>
          </div>
        }
      />
      <EraListFilterBar resetLabel={tc('filterReset')} onReset={() => setDate(hotelDateKey())}>
        <DatePicker
          label={tc('datePlaceholder')}
          value={date}
          onChange={(next) => {
            if (next) setDate(next);
          }}
          placeholder={tc('datePlaceholder')}
          preset="date"
        />
      </EraListFilterBar>
      {warn ? <p className="mb-2 text-sm text-amber-800">{t('pairsLeftover')}</p> : null}
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              <th className="px-3 py-2">{t('colMaid')}</th>
              <th className="px-3 py-2">{t('floor')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-b border-[#ECF0F1]">
                <td className="px-3 py-3 text-[#7F8C8D]" colSpan={2}>
                  {t('rotationEmpty')}{' '}
                  <Link href="/hk/maids" className="text-[#2980B9] underline">
                    {t('maidsLink')}
                  </Link>
                  {' · '}
                  <Link href="/hk/roster" className="text-[#2980B9] underline">
                    {t('rosterLink')}
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[#ECF0F1]">
                  <td className="px-3 py-2 font-medium">{r.housekeeper.name}</td>
                  <td className="px-3 py-2">
                    {r.pair.floorLow}–{r.pair.floorHigh}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <EraModal
        open={swapOpen}
        title={t('swapPairs')}
        onClose={() => setSwapOpen(false)}
        footer={
          <EraModalFooter
            formId="rotation-swap"
            onCancel={() => setSwapOpen(false)}
            busy={busy}
            submitDisabled={!a || !b || a === b}
            submitLabel={t('swapPairs')}
          />
        }
      >
        <form id="rotation-swap" onSubmit={(e) => void swap(e)} className="space-y-3">
          <CatalogField
            kind="ENTITY_REF"
            label={t('swapA')}
            value={a}
            onChange={(v) => setA(String(v))}
            options={people}
            emptyLabel={t('rotationSwapNeed')}
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t('swapB')}
            value={b}
            onChange={(v) => setB(String(v))}
            options={people}
            emptyLabel={t('rotationSwapNeed')}
          />
        </form>
      </EraModal>
    </>
  );
}
