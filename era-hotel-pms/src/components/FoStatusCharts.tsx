'use client';

import { useState, type ReactNode } from 'react';
import type { MealBoard } from '@/lib/services/fo-status-dashboard.math';

export type ChartSeries = { label: string; color: string; values: number[] };
export type PiePart = { label: string; value: number; color: string };
export type MealHintLabels = {
  breakfast: string;
  lunch: string;
  dinner: string;
  adult: string;
  child1: string;
  child2: string;
  baby: string;
  total: string;
};

const PIE_PALETTE = ['#03a9f4', '#ffc107', '#b388ff', '#2d323e', '#4caf50', '#f44336', '#78909c', '#0d47a1', '#ff8a65', '#80d8ff'];
const AGE_BAR = [
  { key: 'adults' as const, color: '#2d323e' },
  { key: 'child1' as const, color: '#f44336' },
  { key: 'child2' as const, color: '#ffc107' },
  { key: 'baby' as const, color: '#4caf50' },
];

export function chartColor(index: number): string {
  return PIE_PALETTE[index % PIE_PALETTE.length];
}

function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exp;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exp;
}

function ChartFrame({ title, legend, children }: { title: string; legend: { label: string; color: string }[]; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-medium text-slate-700">{title}</h2>
      {children}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GridTable({ labels, series }: { labels: string[]; series: ChartSeries[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="text-slate-500">
            <th className="py-1 pr-2" />
            {labels.map((label) => (
              <th key={label} className="px-1 py-1 font-medium">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((seriesRow) => (
            <tr key={seriesRow.label}>
              <td className="py-1 pr-2 text-slate-600">{seriesRow.label}</td>
              {seriesRow.values.map((value, index) => (
                <td key={labels[index]} className="px-1 py-1">{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hintShift(leftPct: number): string {
  if (leftPct > 72) return '-translate-x-full';
  if (leftPct < 28) return 'translate-x-0';
  return '-translate-x-1/2';
}

function DayHint({
  title,
  rows,
  leftPct,
}: {
  title: string;
  rows: { color: string; text: string }[];
  leftPct: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-1 z-30 rounded bg-[#2f343a] px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg ${hintShift(leftPct)}`}
      style={{ left: `${leftPct}%` }}
    >
      <div className="mb-0.5 font-semibold">{title}</div>
      {rows.map((row) => (
        <div key={row.text} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-block h-2 w-2 shrink-0" style={{ background: row.color }} />
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  );
}

function mealTotal(split: MealBoard[keyof MealBoard]): number {
  return split.adults + split.child1 + split.child2 + split.baby;
}

function MealTableHint({
  title,
  board,
  labels,
  leftPct,
}: {
  title: string;
  board: MealBoard;
  labels: MealHintLabels;
  leftPct: number;
}) {
  const cols = [
    { key: 'breakfast' as const, label: labels.breakfast },
    { key: 'lunch' as const, label: labels.lunch },
    { key: 'dinner' as const, label: labels.dinner },
  ];
  const rows = [
    { key: 'adults' as const, label: labels.adult, color: '#80d8ff' },
    { key: 'child1' as const, label: labels.child1, color: '#f44336' },
    { key: 'child2' as const, label: labels.child2, color: '#ffc107' },
    { key: 'baby' as const, label: labels.baby, color: '#4caf50' },
  ];
  return (
    <div
      className={`pointer-events-none absolute top-1 z-30 rounded bg-[#2f343a] px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg ${hintShift(leftPct)}`}
      style={{ left: `${leftPct}%` }}
    >
      <div className="mb-1 font-semibold">{title}</div>
      <table className="border-separate border-spacing-x-2">
        <thead>
          <tr className="text-slate-200">
            <th />
            {cols.map((col) => (
              <th key={col.key} className="px-1 text-right font-medium">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th className="pr-1 text-left font-normal">
                <span className="mr-1 inline-block h-2 w-2" style={{ background: row.color }} />
                {row.label}
              </th>
              {cols.map((col) => (
                <td key={col.key} className="px-1 text-right">{board[col.key][row.key]}</td>
              ))}
            </tr>
          ))}
          <tr className="font-semibold">
            <th className="pr-1 text-left">{labels.total}</th>
            {cols.map((col) => (
              <td key={col.key} className="px-1 text-right">{mealTotal(board[col.key])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ColumnChart({
  title,
  labels,
  series,
  stacked = false,
  grid = false,
  formatValue,
  hint = 'day',
}: {
  title: string;
  labels: string[];
  series: ChartSeries[];
  stacked?: boolean;
  grid?: boolean;
  formatValue?: (value: number, seriesIndex: number, dayIndex: number) => string;
  /** `segment` shows only the bar under the pointer (availability). `day` lists every series. */
  hint?: 'day' | 'segment';
}) {
  const [hover, setHover] = useState<{ day: number; series: number | null } | null>(null);
  const peak = Math.max(
    1,
    ...labels.map((_, index) =>
      stacked
        ? series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0)
        : Math.max(...series.map((item) => item.values[index] ?? 0), 0),
    ),
  );
  const max = niceMax(peak);
  const width = 640;
  const height = 220;
  const pad = { l: 44, r: 8, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = labels.length > 0 ? innerW / labels.length : innerW;
  const ticks = [0, max / 2, max];
  const show = formatValue ?? ((value: number) => String(value));

  return (
    <ChartFrame title={title} legend={series.map((item) => ({ label: item.label, color: item.color }))}>
      {grid ? (
        <GridTable labels={labels} series={series} />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" onMouseLeave={() => setHover(null)}>
            {ticks.map((tick) => {
              const y = pad.t + innerH - (tick / max) * innerH;
              return (
                <g key={tick}>
                  <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#eceff1" />
                  <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="10" fill="#90a4ae">{Math.round(tick)}</text>
                </g>
              );
            })}
            {labels.map((label, index) => {
              const x0 = pad.l + index * slot;
              const bars = stacked ? (
                (() => {
                  const barW = slot * 0.62;
                  let y = pad.t + innerH;
                  return series.map((item, seriesIndex) => {
                    const value = item.values[index] ?? 0;
                    const h = (value / max) * innerH;
                    y -= h;
                    return { item, seriesIndex, value, h, x: x0 + (slot - barW) / 2, y, w: barW };
                  });
                })()
              ) : (
                (() => {
                  const barW = (slot * 0.78) / Math.max(series.length, 1);
                  return series.map((item, seriesIndex) => {
                    const value = item.values[index] ?? 0;
                    const h = (value / max) * innerH;
                    return {
                      item,
                      seriesIndex,
                      value,
                      h,
                      x: x0 + (slot - barW * series.length) / 2 + seriesIndex * barW,
                      y: pad.t + innerH - h,
                      w: Math.max(barW - 1, 1),
                    };
                  });
                })()
              );
              return (
                <g key={label}>
                  <rect
                    x={x0}
                    y={pad.t}
                    width={slot}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover({ day: index, series: null })}
                  />
                  {bars.map((bar) => bar.h > 0 ? (
                    <g key={bar.item.label}>
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.w}
                        height={bar.h}
                        fill={bar.item.color}
                        pointerEvents={hint === 'segment' ? 'auto' : 'none'}
                        onMouseEnter={() => setHover({ day: index, series: bar.seriesIndex })}
                      />
                      {bar.h > 16 ? (
                        <text x={bar.x + bar.w / 2} y={bar.y + bar.h / 2 + 3} textAnchor="middle" fontSize="10" fill="#263238" pointerEvents="none">
                          {bar.value}
                        </text>
                      ) : null}
                    </g>
                  ) : null)}
                  <text x={x0 + slot / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#607d8b">{label}</text>
                </g>
              );
            })}
          </svg>
          {hover != null ? (
            <DayHint
              title={labels[hover.day] ?? ''}
              leftPct={((pad.l + hover.day * slot + slot / 2) / width) * 100}
              rows={(hint === 'segment' && hover.series != null ? [series[hover.series]] : series)
                .filter((item): item is ChartSeries => item != null)
                .map((item) => {
                  const seriesIndex = series.indexOf(item);
                  return {
                    color: item.color,
                    text: `${item.label}: ${show(item.values[hover.day] ?? 0, seriesIndex, hover.day)}`,
                  };
                })}
            />
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

export function LineChart({
  title,
  labels,
  values,
  color,
  seriesLabel,
  grid = false,
  formatValue,
}: {
  title: string;
  labels: string[];
  values: number[];
  color: string;
  seriesLabel: string;
  grid?: boolean;
  formatValue?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...values));
  const width = 640;
  const height = 220;
  const pad = { l: 44, r: 8, t: 18, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ticks = [0, max / 2, max];
  const show = formatValue ?? ((value: number) => String(value));
  const points = values.map((value, index) => {
    const x = pad.l + (values.length <= 1 ? innerW / 2 : (index / (values.length - 1)) * innerW);
    const y = pad.t + innerH - (value / max) * innerH;
    return { x, y, value };
  });
  const poly = points.map((point) => `${point.x},${point.y}`).join(' ');
  const baseline = pad.t + innerH;
  const area = points.length
    ? `${points[0].x},${baseline} ${poly} ${points[points.length - 1].x},${baseline}`
    : '';

  return (
    <ChartFrame title={title} legend={[{ label: seriesLabel, color }]}>
      {grid ? (
        <GridTable labels={labels} series={[{ label: seriesLabel, color, values }]} />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" onMouseLeave={() => setHover(null)}>
            {ticks.map((tick) => {
              const y = pad.t + innerH - (tick / max) * innerH;
              return (
                <g key={tick}>
                  <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#eceff1" />
                  <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="10" fill="#90a4ae">{Math.round(tick)}</text>
                </g>
              );
            })}
            {area ? <polygon points={area} fill={color} fillOpacity="0.35" /> : null}
            <polyline fill="none" stroke={color} strokeWidth="2" points={poly} />
            {points.map((point, index) => (
              <g key={labels[index]}>
                <text x={point.x} y={point.y - 6} textAnchor="middle" fontSize="9" fill="#6a1b9a">{show(point.value)}</text>
                <circle cx={point.x} cy={point.y} r="3" fill={color} />
                <rect
                  x={point.x - (points.length <= 1 ? innerW / 2 : innerW / points.length / 2)}
                  y={pad.t}
                  width={points.length <= 1 ? innerW : innerW / points.length}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                />
                <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#607d8b">{labels[index]}</text>
              </g>
            ))}
          </svg>
          {hover != null ? (
            <DayHint
              title={labels[hover] ?? ''}
              leftPct={(points[hover].x / width) * 100}
              rows={[{ color, text: `${seriesLabel}: ${show(values[hover] ?? 0)}` }]}
            />
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

/** One stacked column per day (ages). Hover shows the breakfast / lunch / dinner matrix. */
export function AgeBoardChart({
  title,
  labels,
  groups,
  ages,
  grid = false,
  mealHints,
  mealLabels,
}: {
  title: string;
  labels: string[];
  groups: { name: string; adults: number[]; child1: number[]; child2: number[]; baby: number[] }[];
  ages: { key: 'adults' | 'child1' | 'child2' | 'baby'; label: string; color: string }[];
  grid?: boolean;
  mealHints?: MealBoard[];
  mealLabels?: MealHintLabels;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const series: ChartSeries[] = groups.flatMap((group) =>
    ages.map((age) => ({
      label: `${group.name} · ${age.label}`,
      color: age.color,
      values: group[age.key],
    })),
  );
  const peak = Math.max(
    1,
    ...labels.map((_, index) =>
      groups.reduce(
        (sum, group) => sum + (group.adults[index] ?? 0) + (group.child1[index] ?? 0) + (group.child2[index] ?? 0) + (group.baby[index] ?? 0),
        0,
      ),
    ),
  );
  const max = niceMax(peak);
  const width = 640;
  const height = 220;
  const pad = { l: 40, r: 8, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = labels.length > 0 ? innerW / labels.length : innerW;
  const boardLegend = mealLabels
    ? [
        { label: mealLabels.breakfast, color: '#80d8ff' },
        { label: mealLabels.lunch, color: '#80d8ff' },
        { label: mealLabels.dinner, color: '#80d8ff' },
      ]
    : ages.map((age) => ({ label: age.label, color: age.color }));

  return (
    <ChartFrame title={title} legend={boardLegend}>
      {grid ? (
        <GridTable labels={labels} series={series} />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" onMouseLeave={() => setHover(null)}>
            {[0, max / 2, max].map((tick) => {
              const y = pad.t + innerH - (tick / max) * innerH;
              return (
                <g key={tick}>
                  <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#eceff1" />
                  <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="10" fill="#90a4ae">{Math.round(tick)}</text>
                </g>
              );
            })}
            {labels.map((label, index) => {
              const x0 = pad.l + index * slot;
              const barW = slot * 0.62;
              const x = x0 + (slot - barW) / 2;
              let y = pad.t + innerH;
              const total = groups.reduce(
                (sum, group) => sum + (group.adults[index] ?? 0) + (group.child1[index] ?? 0) + (group.child2[index] ?? 0) + (group.baby[index] ?? 0),
                0,
              );
              return (
                <g key={label}>
                  <rect x={x0} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(index)} />
                  {groups.map((group) =>
                    ages.map((age) => {
                      const value = group[age.key][index] ?? 0;
                      const h = (value / max) * innerH;
                      y -= h;
                      return h > 0 ? (
                        <rect key={`${group.name}-${age.key}`} x={x} y={y} width={barW} height={h} fill={age.color} pointerEvents="none" />
                      ) : null;
                    }),
                  )}
                  {total > 0 ? (
                    <text x={x0 + slot / 2} y={pad.t + innerH - (total / max) * innerH - 4} textAnchor="middle" fontSize="10" fill="#455a64">
                      {total}
                    </text>
                  ) : null}
                  <text x={x0 + slot / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#607d8b">{label}</text>
                </g>
              );
            })}
          </svg>
          {hover != null && mealHints?.[hover] && mealLabels ? (
            <MealTableHint
              title={labels[hover] ?? ''}
              board={mealHints[hover]}
              labels={mealLabels}
              leftPct={((pad.l + hover * slot + slot / 2) / width) * 100}
            />
          ) : null}
          {hover != null && !(mealHints?.[hover] && mealLabels) ? (
            <DayHint
              title={labels[hover] ?? ''}
              leftPct={((pad.l + hover * slot + slot / 2) / width) * 100}
              rows={series
                .filter((item) => (item.values[hover] ?? 0) > 0)
                .map((item) => ({ color: item.color, text: `${item.label}: ${item.values[hover] ?? 0}` }))}
            />
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}

/** Selected-day board: three stacked columns, same meal matrix on hover. */
export function BoardDayChart({
  title,
  board,
  labels,
}: {
  title: string;
  board: MealBoard;
  labels: MealHintLabels;
}) {
  const [hover, setHover] = useState(false);
  const cols = [
    { key: 'breakfast' as const, label: labels.breakfast },
    { key: 'lunch' as const, label: labels.lunch },
    { key: 'dinner' as const, label: labels.dinner },
  ];
  const max = niceMax(Math.max(1, ...cols.map((col) => mealTotal(board[col.key]))));
  const width = 280;
  const height = 160;
  const pad = { l: 28, r: 8, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const slot = innerW / cols.length;

  return (
    <section className="relative rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-medium text-slate-700">{title}</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" onMouseLeave={() => setHover(false)}>
        {cols.map((col, index) => {
          const x0 = pad.l + index * slot;
          const barW = slot * 0.55;
          const x = x0 + (slot - barW) / 2;
          let y = pad.t + innerH;
          const total = mealTotal(board[col.key]);
          return (
            <g key={col.key}>
              <rect x={x0} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(true)} />
              {AGE_BAR.map((age) => {
                const value = board[col.key][age.key];
                const h = (value / max) * innerH;
                y -= h;
                return h > 0 ? (
                  <rect key={age.key} x={x} y={y} width={barW} height={h} fill={age.color} pointerEvents="none" />
                ) : null;
              })}
              <text x={x0 + slot / 2} y={pad.t + innerH - (total / max) * innerH - 3} textAnchor="middle" fontSize="11" fill="#37474f">
                {total}
              </text>
              <text x={x0 + slot / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#607d8b">{col.label}</text>
            </g>
          );
        })}
      </svg>
      {hover ? <MealTableHint title={title} board={board} labels={labels} leftPct={55} /> : null}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {[
          [labels.adult, '#2d323e'],
          [labels.child1, '#f44336'],
          [labels.child2, '#ffc107'],
          [labels.baby, '#4caf50'],
        ].map(([label, color]) => (
          <li key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PieChart({ title, parts }: { title: string; parts: PiePart[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const cx = 70;
  const cy = 70;
  const radius = 58;
  let angle = -Math.PI / 2;
  const slices = parts.filter((part) => part.value > 0).map((part) => {
    const sweep = total > 0 ? (part.value / total) * Math.PI * 2 : 0;
    const start = angle;
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    const path = sweep >= Math.PI * 2 - 0.001
      ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...part, path };
  });
  const active = slices.find((slice) => slice.label === hover);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[13px] font-medium text-slate-700">{title}</h2>
      <div className="relative flex items-center gap-3">
        <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" onMouseLeave={() => setHover(null)}>
          {total <= 0 ? <circle cx={cx} cy={cy} r={radius} fill="#eceff1" /> : null}
          {slices.map((slice) => (
            <path key={slice.label} d={slice.path} fill={slice.color} onMouseEnter={() => setHover(slice.label)} />
          ))}
        </svg>
        {active ? (
          <div className="pointer-events-none absolute left-24 top-2 z-30 rounded bg-[#2f343a] px-2.5 py-1.5 text-[11px] text-white shadow-lg">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-2 w-2" style={{ background: active.color }} />
              <span>{active.label}: {active.value}</span>
            </div>
          </div>
        ) : null}
        <ul className="space-y-1 text-[11px] text-slate-600">
          {parts.map((part) => (
            <li key={part.label} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: part.color }} />
              <span>{part.label} ({part.value})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function RoomTypeChart({
  title,
  rows,
  soldLabel,
  availableLabel,
}: {
  title: string;
  rows: { code: string; sold: number; available: number }[];
  soldLabel: string;
  availableLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = niceMax(Math.max(1, ...rows.map((row) => Math.max(row.sold, row.available))));
  const active = rows.find((row) => row.code === hover);
  return (
    <ChartFrame title={title} legend={[{ label: soldLabel, color: '#0d47a1aa' }, { label: availableLabel, color: '#ffff8daa' }]}>
      <div className="relative space-y-2">
        {rows.map((row) => (
          <div
            key={row.code}
            className="grid grid-cols-[4.5rem_1fr] items-center gap-2"
            onMouseEnter={() => setHover(row.code)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="truncate text-[11px] text-slate-600">{row.code}</span>
            <svg viewBox="0 0 200 18" className="h-4 w-full" role="img">
              <rect x="0" y="1" width={(row.sold / max) * 200} height="7" fill="#0d47a1aa" />
              <rect x="0" y="10" width={(row.available / max) * 200} height="7" fill="#ffff8daa" />
            </svg>
          </div>
        ))}
        {active ? (
          <div className="pointer-events-none absolute right-0 top-0 z-30 rounded bg-[#2f343a] px-2.5 py-1.5 text-[11px] text-white shadow-lg">
            <div className="mb-0.5 font-semibold">{active.code}</div>
            <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2" style={{ background: '#0d47a1' }} />{soldLabel}: {active.sold}</div>
            <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-2" style={{ background: '#ffff8d' }} />{availableLabel}: {active.available}</div>
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}
