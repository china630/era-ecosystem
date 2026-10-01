'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { CatalogField, PageHeader, showApiError } from '@era/satellite-kit/ui';

type SheetRow = {
  roomId: string;
  roomNumber: string;
  floor: number;
  jobType?: string;
  hkCondition?: string;
  guests?: string;
  reservationId?: string | null;
};

type Rot = {
  housekeeperId: string;
  housekeeper: { id: string; name: string };
  pair: { floorLow: number; floorHigh: number };
};

const OUTCOMES = ['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO'] as const;
const JOBS = new Set(['STAYOVER', 'DEPARTURE', 'ARRIVAL_PREP', 'NSR', 'OTHER', 'DEEP', 'LINEN', 'OK']);
const HK = new Set(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']);

export default function HkMobilePage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [rotation, setRotation] = useState<Rot[]>([]);
  const [maidId, setMaidId] = useState('');

  const load = useCallback(async () => {
    const date = hotelDateKey();
    const [sRes, rRes] = await Promise.all([
      fetch(`/api/housekeeping/sheet?all=1&date=${date}`),
      fetch(`/api/housekeeping/rotation?date=${date}`),
    ]);
    const sJson = await sRes.json();
    if (sRes.ok) {
      const pages = Array.isArray(sJson) ? sJson : [];
      const flat: SheetRow[] = [];
      for (const page of pages) {
        for (const row of page.rows ?? []) flat.push(row as SheetRow);
      }
      setRows(flat);
    } else showApiError(sJson, tc('loadError'));
    const rJson = await rRes.json();
    if (rRes.ok) setRotation(Array.isArray(rJson) ? rJson : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => {
    if (!maidId) return rows;
    const rot = rotation.find((r) => r.housekeeperId === maidId || r.housekeeper.id === maidId);
    if (!rot) return [];
    return rows.filter((x) => x.floor >= rot.pair.floorLow && x.floor <= rot.pair.floorHigh);
  }, [rows, rotation, maidId]);

  async function outcome(roomId: string, code: string) {
    const date = hotelDateKey();
    const res = await fetch('/api/housekeeping/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, date, outcome: code }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    await load();
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <PageHeader title={t('mobileTitle')} subtitle={rotation.length === 0 ? t('mobileEmpty') : t('sheetHint')} />
      <CatalogField
        kind="ENTITY_REF"
        label={t('myFloors')}
        value={maidId}
        onChange={(v) => setMaidId(String(v))}
        options={rotation.map((r) => ({
          value: r.housekeeperId ?? r.housekeeper.id,
          label: `${r.housekeeper.name} ${r.pair.floorLow}–${r.pair.floorHigh}`,
        }))}
        emptyLabel="—"
      />
      {mine.length === 0 ? <p className="mt-4 text-sm text-[#7F8C8D]">{t('mobileNoRows')}</p> : null}
      <ul className="mt-4 space-y-2">
        {mine.map((row) => (
          <li key={row.roomId} className="rounded border border-[#D5DADF] bg-white p-3">
            <p className="text-sm font-medium text-[#34495E]">
              {row.roomNumber} · {t('floor')} {row.floor}
            </p>
            <p className="text-[12px] text-[#7F8C8D]">
              {row.hkCondition && HK.has(row.hkCondition) ? t(`hkCond.${row.hkCondition}`) : row.hkCondition ?? ''}
              {' · '}
              {row.jobType && JOBS.has(row.jobType) ? t(`job.${row.jobType}`) : row.jobType ?? ''}
              {row.guests ? ` · ${row.guests}` : ''}
            </p>
            <div className="mt-2">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t('outcome')}
                value=""
                onChange={(v) => void outcome(row.roomId, String(v))}
                options={OUTCOMES.map((o) => ({
                  value: o,
                  label: o === 'REFUSED' ? t('refused') : o,
                }))}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
