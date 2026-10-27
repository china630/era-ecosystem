'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { CatalogField, PageHeader, showApiError } from '@era/satellite-kit/ui';
import { HkStatusMark } from '@/components/HkStatusMark';
import { useAuth } from '@/hooks/useAuth';

type SheetRow = {
  roomId: string;
  roomNumber: string;
  floor: number;
  jobType?: string;
  hkCondition?: string;
  guests?: string;
  reservationId?: string | null;
  visitOutcome?: string;
};

type Rot = {
  housekeeperId: string;
  housekeeper: { id: string; name: string };
  pair: { floorLow: number; floorHigh: number };
};

const OUTCOMES = ['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO'] as const;
const JOBS = new Set(['STAYOVER', 'DEPARTURE', 'ARRIVAL_PREP', 'NSR', 'OTHER', 'DEEP', 'LINEN', 'OK', 'STAY', 'NONE']);

export default function HkMobilePage() {
  const { user } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [rotation, setRotation] = useState<Rot[]>([]);
  const [maidId, setMaidId] = useState('');
  const [autoPicked, setAutoPicked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const date = hotelDateKey();

  const load = useCallback(async () => {
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
    setLoaded(true);
  }, [date, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (autoPicked || !loaded || rotation.length === 0 || maidId) return;
    const norm = (s: string) => s.trim().toLowerCase();
    const me = user?.fullName ? norm(user.fullName) : '';
    const byName = me
      ? rotation.find((r) => norm(r.housekeeper.name) === me || norm(r.housekeeper.name).includes(me))
      : undefined;
    const pick = byName ?? (rotation.length === 1 ? rotation[0] : undefined);
    if (pick) {
      setMaidId(pick.housekeeperId ?? pick.housekeeper.id);
      setAutoPicked(true);
    }
  }, [autoPicked, loaded, rotation, maidId, user?.fullName]);

  const mine = useMemo(() => {
    if (!maidId) return [];
    const rot = rotation.find((r) => r.housekeeperId === maidId || r.housekeeper.id === maidId);
    if (!rot) return [];
    return rows.filter((x) => x.floor >= rot.pair.floorLow && x.floor <= rot.pair.floorHigh);
  }, [rows, rotation, maidId]);

  async function flag(roomId: string, kind: 'SKIP' | 'SLEEP') {
    const res = await fetch('/api/housekeeping/discrepancy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, date, kind }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else await load();
  }

  async function outcome(roomId: string, code: string) {
    const res = await fetch('/api/housekeeping/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(code ? { roomId, date, outcome: code } : { roomId, date, clear: true }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    await load();
  }

  let subtitle = date;
  if (loaded && rotation.length > 0) {
    subtitle = !maidId ? `${t('mobilePickSelf')} · ${date}` : `${t('sheetHint')} · ${date}`;
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <PageHeader title={t('mobileTitle')} subtitle={subtitle} />
      {loaded && rotation.length === 0 ? (
        <p className="mt-3 text-sm text-[#7F8C8D]">
          {t('mobileEmpty')}{' '}
          <Link href="/hk/rotation" className="text-[#2980B9] underline">
            {t('rotationTitle')}
          </Link>
        </p>
      ) : null}
      <CatalogField
        kind="ENTITY_REF"
        label={t('myFloors')}
        value={maidId}
        onChange={(v) => setMaidId(String(v))}
        options={rotation.map((r) => ({
          value: r.housekeeperId ?? r.housekeeper.id,
          label: `${r.housekeeper.name} ${r.pair.floorLow}–${r.pair.floorHigh}`,
        }))}
        emptyLabel={rotation.length === 0 ? t('mobileEmpty') : t('mobilePickSelf')}
      />
      {loaded && rotation.length > 0 && !maidId ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">{t('mobilePickSelf')}</p>
      ) : null}
      {loaded && maidId && mine.length === 0 ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">{t('mobileNoRows')}</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {mine.map((row) => (
          <li key={row.roomId} className="rounded border border-[#D5DADF] bg-white p-3">
            <p className="text-sm font-medium text-[#34495E]">
              {row.roomNumber} · {t('floor')} {row.floor}
            </p>
            <p className="flex flex-wrap items-center gap-1 text-[12px] text-[#7F8C8D]">
              <HkStatusMark status={row.hkCondition} />
              <span>
                {row.jobType && JOBS.has(row.jobType) ? t(`job.${row.jobType}`) : row.jobType ?? ''}
                {row.guests ? ` · ${row.guests}` : ''}
              </span>
            </p>
            <div className="mt-2">
              <CatalogField
                kind="CLOSED_SMALL"
                label={t('outcome')}
                value={row.visitOutcome ?? ''}
                onChange={(v) => void outcome(row.roomId, String(v))}
                options={OUTCOMES.map((o) => ({
                  value: o,
                  label: o === 'REFUSED' ? t('refused') : o,
                }))}
              />
              <p className="mt-2 text-[12px] text-[#7F8C8D]">{t('mobileMismatch')}</p>
              <div className="mt-1 flex gap-2">
                <button type="button" className="rounded border border-[#D5DADF] px-2 py-1 text-xs" onClick={() => void flag(row.roomId, 'SKIP')}>
                  {t('sendSkip')}
                </button>
                <button type="button" className="rounded border border-[#D5DADF] px-2 py-1 text-xs" onClick={() => void flag(row.roomId, 'SLEEP')}>
                  {t('sendSleep')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
