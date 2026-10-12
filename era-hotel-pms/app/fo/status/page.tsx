'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { addBakuDays, bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { DatePicker, showApiError } from '@era/satellite-kit/ui';
import ReservationCardModal from '@/components/ReservationCardModal';
import type { FlowCard, ForecastPoint, FoStatusSnapshot, StatusListRow, TypeMatrix } from '@/lib/services/fo-status-dashboard.math';

type Payload = FoStatusSnapshot & {
  reportedAt: string;
  exchangeRates: { currency: string; exchange: string; buy: string }[];
};

type Tab = 'home' | 'expectedArrivals' | 'expectedDepartures' | 'realizedArrivals' | 'realizedDepartures';

const CLEAN_COLORS = ['#03a9f4', '#607d8b', '#006400', '#ffc107', '#000000', '#444444', '#a52a2a'];
const OCC_COLORS = ['#2d323e', '#40598e', '#f44336', '#ffc107'];

function money(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: whole ? 0 : 2,
    minimumFractionDigits: whole ? 0 : 2,
  }).format(n);
}

function percent(n: number | null): string {
  if (n == null) return '—';
  return `%${n.toFixed(2)}`;
}

function ddmm(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}.${m}`;
}

function conic(parts: { value: number; color: string }[]): string {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return 'conic-gradient(#e5e7eb 0 100%)';
  let cursor = 0;
  const stops = parts.map((p) => {
    const start = cursor;
    cursor += (p.value / total) * 100;
    return `${p.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(',')})`;
}

function MatrixCard({ title, matrix }: { title: string; matrix: TypeMatrix }) {
  const t = useTranslations('foStatus');
  const cells: [string, number][] = [
    ['NR', matrix.nr],
    ['DU', matrix.du],
    ['SHR', matrix.shr],
    ['WO', matrix.wo],
    ['NS', matrix.ns],
    ['OT', matrix.ot],
    ['VR', matrix.vr],
    ['IU', matrix.iu],
    ['BO', matrix.bo],
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-center text-[13px] text-slate-600">{title}</h2>
      <p className="text-center text-4xl font-semibold leading-none text-sky-500">{matrix.rooms}</p>
      <p className="mb-2 text-center text-[11px] text-slate-500">{t('rooms')}</p>
      <table className="mb-2 w-full text-center text-[11px] text-slate-600">
        <tbody>
          <tr>
            {cells.slice(0, 5).map(([code]) => (
              <th key={code} className="font-medium">{code}</th>
            ))}
          </tr>
          <tr>
            {cells.slice(0, 5).map(([code, n]) => (
              <td key={code}>{n}</td>
            ))}
          </tr>
          <tr>
            {cells.slice(5).map(([code]) => (
              <th key={code} className="font-medium">{code}</th>
            ))}
            <th />
          </tr>
          <tr>
            {cells.slice(5).map(([code, n]) => (
              <td key={code}>{n}</td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      <p className="text-[12px] text-slate-700">
        {t('totalPax')} <b>{matrix.pax}</b>
        <span className="mx-2 text-slate-300">|</span>
        {t('totalPerson')} <b>{matrix.persons}</b>
      </p>
      <p className="text-[11px] text-slate-500">
        {t('adult')}: {matrix.adults} · {t('child1')}: {matrix.child1} · {t('child2')}: {matrix.child2} · {t('baby')}: {matrix.baby}
      </p>
    </section>
  );
}

function FlowSection({ title, card }: { title: string; card: FlowCard }) {
  const t = useTranslations('foStatus');
  const rows: [string, string][] = [
    [t('resCount'), String(card.resCount)],
    [t('roomNight'), String(card.roomNights)],
    [t('paxNight'), String(card.paxNights)],
    [t('roomPercent'), percent(card.roomPercent)],
    [t('bedPercent'), percent(card.bedPercent)],
    [t('avgRoomRate'), money(card.adr)],
    [t('revenue'), money(card.revenue)],
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-700">{title}</h2>
      <dl className="space-y-1 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StackedChart({
  title,
  points,
  series,
  grid,
}: {
  title: string;
  points: ForecastPoint[];
  series: { key: keyof ForecastPoint; label: string; color: string }[];
  grid: boolean;
}) {
  const max = Math.max(
    1,
    ...points.map((p) => series.reduce((sum, s) => sum + Number(p[s.key] ?? 0), 0)),
  );
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-medium text-slate-700">{title}</h2>
      {grid ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 pr-2">{title}</th>
                {points.map((p) => (
                  <th key={p.day} className="px-1 py-1 font-medium">{ddmm(p.day)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.label}>
                  <td className="py-1 pr-2 text-slate-600">{s.label}</td>
                  {points.map((p) => (
                    <td key={p.day} className="px-1 py-1">{String(p[s.key] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-1">
          {points.map((p) => (
            <div key={p.day} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-slate-500">{ddmm(p.day)}</span>
              <div className="flex h-3 flex-1 overflow-hidden rounded-sm bg-slate-100">
                {series.map((s) => (
                  <div
                    key={s.label}
                    style={{ width: `${(Number(p[s.key] ?? 0) / max) * 100}%`, background: s.color }}
                    title={`${s.label}: ${String(p[s.key] ?? 0)}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StayTable({ rows, onOpen }: { rows: StatusListRow[]; onOpen: (id: string) => void }) {
  const t = useTranslations('foStatus');
  if (rows.length === 0) return <p className="text-[13px] text-slate-500">{t('empty')}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2">{t('guest')}</th>
            <th className="px-3 py-2">{t('room')}</th>
            <th className="px-3 py-2">{t('roomType')}</th>
            <th className="px-3 py-2">{t('meal')}</th>
            <th className="px-3 py-2">{t('arrival')}</th>
            <th className="px-3 py-2">{t('departure')}</th>
            <th className="px-3 py-2">{t('adult')}</th>
            <th className="px-3 py-2">{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <button type="button" className="text-sky-700 underline" onClick={() => onOpen(row.id)}>
                  {row.guestName}
                </button>
              </td>
              <td className="px-3 py-2">{row.roomNumber ?? '—'}</td>
              <td className="px-3 py-2">{row.roomType}</td>
              <td className="px-3 py-2">{row.meal ?? '—'}</td>
              <td className="px-3 py-2">{row.inYmd}</td>
              <td className="px-3 py-2">{row.outYmd}</td>
              <td className="px-3 py-2">{row.adults + row.child1 + row.child2 + row.baby}</td>
              <td className="px-3 py-2">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FoStatusPage() {
  const t = useTranslations('foStatus');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [day, setDay] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [withRevenue, setWithRevenue] = useState(false);
  const [grid, setGrid] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (nextDay: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (nextDay) q.set('date', nextDay);
      if (waiting) q.set('waiting', '1');
      if (withRevenue) q.set('revenue', '1');
      const res = await fetch(`/api/fo/status-dashboard?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        showApiError(json, tc('loadError'));
        setData(null);
        return;
      }
      const payload = json as Payload;
      setData(payload);
      setDay((current) => current || payload.day);
    } catch (err) {
      showApiError(err, tc('loadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tc, waiting, withRevenue]);

  useEffect(() => {
    void load(day);
  }, [load, day]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: t('home') },
    { id: 'expectedArrivals', label: t('expectedArrivals') },
    { id: 'expectedDepartures', label: t('expectedDepartures') },
    { id: 'realizedArrivals', label: t('realizedArrivals') },
    { id: 'realizedDepartures', label: t('realizedDepartures') },
  ];

  const monthLabel = data
    ? new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(Number(data.day.slice(0, 4)), Number(data.day.slice(5, 7)) - 1, Number(data.day.slice(8, 10)))),
      )
    : '';

  const cleanParts = data
    ? [
        { label: t('clean'), value: data.clean.clean, color: CLEAN_COLORS[0] },
        { label: t('closed'), value: data.clean.closed, color: CLEAN_COLORS[1] },
        { label: t('confirmed'), value: data.clean.confirmed, color: CLEAN_COLORS[2] },
        { label: t('dirty'), value: data.clean.dirty, color: CLEAN_COLORS[3] },
        { label: t('maintenance'), value: data.clean.maintenance, color: CLEAN_COLORS[4] },
        { label: t('reserved'), value: data.clean.reserved, color: CLEAN_COLORS[5] },
        { label: t('touched'), value: data.clean.touched, color: CLEAN_COLORS[6] },
      ]
    : [];
  const occParts = data
    ? [
        { label: t('occupiedRooms'), value: data.occupancyPie.occupied, color: OCC_COLORS[0] },
        { label: t('availableRooms'), value: data.occupancyPie.available, color: OCC_COLORS[1] },
        { label: t('blockRooms'), value: data.occupancyPie.blocks, color: OCC_COLORS[2] },
        { label: t('dayUseRooms'), value: data.occupancyPie.dayUse, color: OCC_COLORS[3] },
      ]
    : [];

  return (
    <main className="min-w-0 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-slate-500">
          {data ? t('reportedAt', { at: bakuDateTimeDisplay(data.reportedAt) }) : t('title')}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={() => day && setDay(addBakuDays(day, -1))} aria-label={t('prevDay')}>‹</button>
          <DatePicker
            label={tc('date')}
            value={day}
            onChange={(iso) => iso && setDay(iso)}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
          />
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={() => day && setDay(addBakuDays(day, 1))} aria-label={t('nextDay')}>›</button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`px-3 py-2 text-[13px] ${tab === item.id ? 'border-b-2 border-sky-600 font-medium text-sky-700' : 'text-slate-600'}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-slate-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} />
          {t('includingWaiting')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withRevenue} onChange={(e) => setWithRevenue(e.target.checked)} />
          {t('withRevenue')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
          {t('gridView')}
        </label>
      </div>

      {loading ? <p className="text-[13px] text-slate-500">{tc('loading')}</p> : null}

      {data && tab === 'home' ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MatrixCard title={t('currentInHouse')} matrix={data.inHouse} />
              <MatrixCard title={t('expectedArrivals')} matrix={data.expectedArrivals} />
              <MatrixCard title={t('expectedDepartures')} matrix={data.expectedDepartures} />
              <MatrixCard title={t('endOfDay')} matrix={data.endOfDay} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h2 className="mb-2 text-[14px] font-medium">{t('currentStatus')}</h2>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-right text-slate-500">
                      <th className="py-1 text-left" />
                      <th className="py-1">{t('room')}</th>
                      <th className="py-1">{t('pax')}</th>
                      <th className="py-1">{t('percent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movement.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <th className="py-2 text-left font-semibold">{t(row.key as 'start')}</th>
                        <td className="py-2 text-right">{row.rooms}</td>
                        <td className="py-2 text-right">{row.pax}</td>
                        <td className="py-2 text-right">{percent(row.percent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h2 className="mb-3 text-[14px] font-medium">{t('roomStatus')}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PieBlock title={t('cleanState')} parts={cleanParts} />
                  <PieBlock title={t('occupancy')} parts={occParts} />
                </div>
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <StackedChart
                title={t('availability')}
                points={data.forecast}
                grid={grid}
                series={[
                  { key: 'occupied', label: t('resOccupied'), color: '#80d8ff' },
                  { key: 'available', label: t('availableRooms'), color: '#ffe082' },
                  { key: 'blocks', label: t('blockOccupied'), color: '#b388ff' },
                  { key: 'closed', label: t('closedRooms'), color: '#546e7a' },
                ]}
              />
              <StackedChart
                title={t('arrivalsDepartures')}
                points={data.forecast}
                grid={grid}
                series={[
                  { key: 'arriving', label: t('arrivingRooms'), color: '#ffe082' },
                  { key: 'departing', label: t('departingRooms'), color: '#b388ff' },
                  { key: 'occupied', label: t('totalOccupied'), color: '#80d8ff' },
                ]}
              />
              <StackedChart
                title={t('occupancyChart')}
                points={data.forecast}
                grid={grid}
                series={[
                  { key: 'individual', label: t('individual'), color: '#ffe082' },
                  { key: 'group', label: t('groupOcc'), color: '#b388ff' },
                ]}
              />
              <StackedChart
                title={t('roomRevenue')}
                points={data.forecast}
                grid={grid}
                series={[{ key: 'revenue', label: t('roomRevenue'), color: '#9c27b0' }]}
              />
              <StackedChart
                title={t('boardState')}
                points={data.forecast}
                grid={grid}
                series={[
                  { key: 'adults', label: t('adult'), color: '#80d8ff' },
                  { key: 'child1', label: t('child1'), color: '#ffe082' },
                  { key: 'child2', label: t('child2'), color: '#b388ff' },
                  { key: 'baby', label: t('baby'), color: '#546e7a' },
                ]}
              />
              <StackedChart
                title={t('accommodation')}
                points={data.forecast}
                grid={grid}
                series={[
                  { key: 'sold', label: t('soldRooms'), color: '#0d47a1' },
                  { key: 'complimentary', label: t('complimentary'), color: '#b388ff' },
                  { key: 'houseUse', label: t('houseUse'), color: '#78909c' },
                  { key: 'available', label: t('availableRooms'), color: '#ffe082' },
                ]}
              />
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-[14px] font-medium">{t('roomTypeAvailability')}</h2>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-right text-slate-500">
                    <th className="py-1 text-left">{t('roomType')}</th>
                    <th>{t('soldRooms')}</th>
                    <th>{t('quota')}</th>
                    <th>{t('availableRooms')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roomTypes.map((rt) => (
                    <tr key={rt.code} className="border-t border-slate-100">
                      <td className="py-1 text-left">{rt.code} · {rt.name}</td>
                      <td className="text-right">{rt.sold}</td>
                      <td className="text-right">{rt.quota}</td>
                      <td className="text-right">{rt.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MiniList title={t('boardToday')} rows={data.board.map((b) => [b.code, String(b.rooms)])} />
              <MiniList
                title={t('ages')}
                rows={[
                  [t('adult'), String(data.ages.adults)],
                  [t('child1'), String(data.ages.child1)],
                  [t('child2'), String(data.ages.child2)],
                  [t('baby'), String(data.ages.baby)],
                ]}
              />
              <MiniList title={t('repeatGuests')} rows={[[t('repeatGuests'), String(data.repeatGuests)]]} />
              <MiniList title={t('folioTypes')} rows={data.folioTypes.map((f) => [f.method, String(f.count)])} />
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-[14px] font-medium">{t('todayReservations')} ({data.todayReservations.length})</h2>
              <StayTable rows={data.todayReservations} onOpen={setOpenId} />
            </section>
          </div>

          <aside className="space-y-3">
            <section className="rounded-lg border border-slate-200 bg-white p-4 text-center">
              <p className="text-slate-500">{monthLabel}</p>
              <p className="text-5xl font-light text-slate-700">{data.day.slice(8, 10)}</p>
              <p className="text-slate-500">{data.day.slice(0, 4)}</p>
            </section>
            <FlowSection title={t('sales')} card={data.sales} />
            <FlowSection title={t('cancellations')} card={data.cancellations} />
            <FlowSection title={t('occupancy')} card={data.occupancy} />
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-700">{t('revenues')}</h2>
              <dl className="space-y-1 text-[12px]">
                {[
                  [t('revenueRoom'), money(data.revenues.room)],
                  [t('revenueFood'), money(data.revenues.food)],
                  [t('revenueBeverage'), money(data.revenues.beverage)],
                  [t('revenueOther'), money(data.revenues.other)],
                  [t('roomNet'), money(data.revenues.roomNet)],
                  [t('netAdr'), money(data.revenues.netAdr)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-700">{t('exchangeRates')}</h2>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left">{t('currency')}</th>
                    <th className="text-right">{t('exchange')}</th>
                    <th className="text-right">{t('buyRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exchangeRates.map((row) => (
                    <tr key={row.currency}>
                      <td>{row.currency}</td>
                      <td className="text-right">{row.exchange}</td>
                      <td className="text-right">{row.buy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-slate-400">{t('fxHint')}</p>
            </section>
          </aside>
        </div>
      ) : null}

      {data && tab !== 'home' ? <StayTable rows={data.lists[tab]} onOpen={setOpenId} /> : null}

      <ReservationCardModal open={openId != null} reservationId={openId} onClose={() => setOpenId(null)} />
    </main>
  );
}

function PieBlock({ title, parts }: { title: string; parts: { label: string; value: number; color: string }[] }) {
  return (
    <div>
      <h3 className="mb-2 text-center text-[12px] text-slate-500">{title}</h3>
      <div className="mx-auto h-28 w-28 rounded-full" style={{ background: conic(parts) }} />
      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2" style={{ background: p.color }} />
            {p.label} ({p.value})
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniList({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-medium">{title}</h2>
      {rows.length === 0 ? <p className="text-[12px] text-slate-400">—</p> : null}
      <dl className="space-y-1 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
