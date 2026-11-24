/**
 * Clinic procedure load heatmap — aggregate live orders by procedureCode × Baku day.
 * Levels prefer fill % when capacity is known; else peak-normalized counts.
 * UI cell label is %; count/capacity stays on hover title.
 */

import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";

export const PROCEDURE_LOAD_LEVELS = 10;

export type ProcedureLoadCell = {
  ymd: string;
  count: number;
  /** Estimated daily seat capacity for this SKU (null = unknown). */
  capacity: number | null;
  /** 0..1 when capacity known. */
  pct: number | null;
  /** 0 = calm (blue) … 9 = hot (red). */
  level: number;
};

export type ProcedureLoadRow = {
  procedureCode: string;
  procedureName: string;
  total: number;
  /** Typical daily capacity for this SKU (null = unknown). */
  dayCapacity: number | null;
  cells: ProcedureLoadCell[];
};

export type ProcedureLoadMatrix = {
  fromYmd: string;
  toYmd: string;
  generatedAt: string;
  days: string[];
  /** true when at least one row has capacity. */
  capacityBased: boolean;
  rows: ProcedureLoadRow[];
};

export function clampLoadHorizonDays(raw: unknown, fallback = 21): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(31, Math.max(3, Math.floor(n)));
}

export function ymdRangeInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  for (let ymd = fromYmd; ymd <= toYmd; ymd = addBakuDays(ymd, 1)) {
    out.push(ymd);
    if (out.length > 62) break;
  }
  return out;
}

/** Map raw count to 0..levels-1 using peak in the snapshot (peak → last step). */
export function countToLevel(count: number, peak: number, levels = PROCEDURE_LOAD_LEVELS): number {
  if (count <= 0 || peak <= 0) return 0;
  if (count >= peak) return levels - 1;
  return Math.min(levels - 1, Math.floor((count / peak) * levels));
}

/** Map fill ratio 0..1+ to 0..9 (70% ≈ mid-warm, 90%+ hot). */
export function pctToLevel(pct: number, levels = PROCEDURE_LOAD_LEVELS): number {
  if (pct <= 0) return 0;
  if (pct >= 1) return levels - 1;
  return Math.min(levels - 1, Math.floor(pct * levels));
}

/**
 * Working-day seat capacity for one SKU:
 * floor(workMinutes / duration) × sum(resource.capacity).
 */
export function estimateDayCapacity(input: {
  dayStartHour: number;
  dayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
  durationMin: number;
  resourceCapacitySum: number;
}): number {
  const open = Math.max(0, input.dayEndHour - input.dayStartHour);
  const lunch = Math.max(0, input.lunchEndHour - input.lunchStartHour);
  const workMin = Math.max(0, (open - lunch) * 60);
  const dur = Math.max(5, Math.floor(input.durationMin) || 30);
  const slots = Math.max(1, Math.floor(workMin / dur));
  const seats = Math.max(1, Math.floor(input.resourceCapacitySum) || 1);
  return slots * seats;
}

/** 10-step blue → red (CSS background). */
export function procedureLoadLevelColor(level: number): string {
  const colors = [
    "#E8F4FC",
    "#D0E8F8",
    "#B0D4F0",
    "#8AB8E0",
    "#6A9CD0",
    "#F0C070",
    "#E8A040",
    "#E07050",
    "#D04040",
    "#B01020",
  ];
  const i = Math.max(0, Math.min(colors.length - 1, Math.floor(level)));
  return colors[i]!;
}

export function buildProcedureLoadMatrix(input: {
  fromYmd?: string;
  toYmd?: string;
  horizonDays?: number;
  /** Raw counts: code → ymd → n */
  counts: Map<string, Map<string, number>>;
  names: Map<string, string>;
  /** Optional daily capacity per procedure code. */
  dayCapacityByCode?: Map<string, number>;
  topN?: number;
  nowYmd?: string;
}): ProcedureLoadMatrix {
  const today = input.nowYmd ?? todayBakuYmd();
  const horizon = clampLoadHorizonDays(input.horizonDays, 21);
  const fromYmd = input.fromYmd ?? today;
  const toYmd = input.toYmd ?? addBakuDays(fromYmd, horizon - 1);
  const days = ymdRangeInclusive(fromYmd, toYmd);
  const topN = input.topN ?? 10;
  const caps = input.dayCapacityByCode ?? new Map<string, number>();

  const totals: Array<{ code: string; total: number }> = [];
  for (const [code, byDay] of input.counts) {
    let total = 0;
    for (const d of days) total += byDay.get(d) ?? 0;
    if (total > 0) totals.push({ code, total });
  }
  totals.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  const picked = totals.slice(0, topN);

  let peak = 1;
  for (const { code } of picked) {
    const byDay = input.counts.get(code);
    if (!byDay) continue;
    for (const d of days) peak = Math.max(peak, byDay.get(d) ?? 0);
  }

  let capacityBased = false;
  const rows: ProcedureLoadRow[] = picked.map(({ code, total }) => {
    const byDay = input.counts.get(code) ?? new Map();
    const rawCap = caps.get(code);
    const dayCapacity =
      rawCap != null && Number.isFinite(rawCap) && rawCap > 0 ? Math.floor(rawCap) : null;
    if (dayCapacity != null) capacityBased = true;
    return {
      procedureCode: code,
      procedureName: input.names.get(code) || code,
      total,
      dayCapacity,
      cells: days.map((ymd) => {
        const count = byDay.get(ymd) ?? 0;
        if (dayCapacity != null) {
          const pct = count / dayCapacity;
          return {
            ymd,
            count,
            capacity: dayCapacity,
            pct,
            level: pctToLevel(pct),
          };
        }
        return {
          ymd,
          count,
          capacity: null,
          pct: null,
          level: countToLevel(count, peak),
        };
      }),
    };
  });

  return {
    fromYmd,
    toYmd,
    generatedAt: new Date().toISOString(),
    days,
    capacityBased,
    rows,
  };
}
