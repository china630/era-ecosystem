/**
 * Clinic procedure load heatmap — aggregate live orders by procedureCode × Baku day.
 * Cheap GROUP-BY style counts; no cabin slot-scan.
 */

import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";

export const PROCEDURE_LOAD_LEVELS = 10;

export type ProcedureLoadCell = {
  ymd: string;
  count: number;
  /** 0 = calm (blue) … 9 = hot (red). */
  level: number;
};

export type ProcedureLoadRow = {
  procedureCode: string;
  procedureName: string;
  total: number;
  cells: ProcedureLoadCell[];
};

export type ProcedureLoadMatrix = {
  fromYmd: string;
  toYmd: string;
  generatedAt: string;
  days: string[];
  rows: ProcedureLoadRow[];
};

export function clampLoadHorizonDays(raw: unknown, fallback = 14): number {
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
  topN?: number;
  nowYmd?: string;
}): ProcedureLoadMatrix {
  const today = input.nowYmd ?? todayBakuYmd();
  const horizon = clampLoadHorizonDays(input.horizonDays, 14);
  const fromYmd = input.fromYmd ?? today;
  const toYmd = input.toYmd ?? addBakuDays(fromYmd, horizon - 1);
  const days = ymdRangeInclusive(fromYmd, toYmd);
  const topN = input.topN ?? 10;

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

  const rows: ProcedureLoadRow[] = picked.map(({ code, total }) => {
    const byDay = input.counts.get(code) ?? new Map();
    return {
      procedureCode: code,
      procedureName: input.names.get(code) || code,
      total,
      cells: days.map((ymd) => {
        const count = byDay.get(ymd) ?? 0;
        return { ymd, count, level: countToLevel(count, peak) };
      }),
    };
  });

  return {
    fromYmd,
    toYmd,
    generatedAt: new Date().toISOString(),
    days,
    rows,
  };
}
