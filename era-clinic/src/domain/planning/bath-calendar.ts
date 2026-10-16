/**
 * Lay bath-series cells across a stay.
 * A block is N working baths, then R working rest days. A closed day resets a streak
 * and does not spend the required rest. One bath per day.
 * Series with fillsRestDays may use a day another series left empty.
 * Locked and manual cells stay. Extra quantity continues after the last kept cell.
 */

export type BathMode = "2" | "3" | "5" | "ALTERNATING";

export type BathModeDef = {
  code: string;
  baths: number;
  rest: number;
};

export const DEFAULT_BATH_MODES: BathModeDef[] = [
  { code: "2", baths: 2, rest: 1 },
  { code: "3", baths: 3, rest: 1 },
  { code: "5", baths: 5, rest: 1 },
  { code: "ALTERNATING", baths: 1, rest: 1 },
];

export function parseBathDayModes(raw: unknown): BathModeDef[] {
  let value = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return DEFAULT_BATH_MODES;
    try {
      value = JSON.parse(text);
    } catch {
      return DEFAULT_BATH_MODES;
    }
  }
  if (!Array.isArray(value)) return DEFAULT_BATH_MODES;
  const out: BathModeDef[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const code = String((row as { code?: unknown }).code ?? "").trim().toUpperCase();
    const baths = Number((row as { baths?: unknown }).baths);
    const rest = Number((row as { rest?: unknown }).rest);
    if (!/^[0-9A-Z_]{1,16}$/.test(code)) continue;
    if (!Number.isFinite(baths) || baths < 1 || baths > 14) continue;
    if (!Number.isFinite(rest) || rest < 0 || rest > 7) continue;
    out.push({ code, baths: Math.floor(baths), rest: Math.floor(rest) });
  }
  return out.length > 0 ? out : DEFAULT_BATH_MODES;
}

export function resolveBathBlock(
  mode: string,
  modes: BathModeDef[] = DEFAULT_BATH_MODES,
): { baths: number; rest: number } {
  const found = modes.find((row) => row.code === mode);
  if (found) return found;
  if (mode === "ALTERNATING") return { baths: 1, rest: 1 };
  const n = Number(mode);
  if (Number.isFinite(n) && n >= 1) return { baths: Math.floor(n), rest: 1 };
  return { baths: 1, rest: 1 };
}

export type StayDay = {
  ymd: string;
  working: boolean;
};

export type SeriesPlanInput = {
  seriesCode: string;
  procedureCode: string;
  mark: string;
  mode: string;
  /** Sessions still allowed, including ones already kept. */
  qty: number;
  fillsRestDays: boolean;
  /** First kept-or-placed session is sitting fill, the rest are full. Same series. */
  sitzThenFull?: boolean;
};

export type BathLayout = "continue" | "fresh";

export type KeptCell = {
  ymd: string;
  procedureCode: string;
  /** Checked-in, completed, a manual pin, or an automatic day that stays put. */
  locked: boolean;
  /** Already saved automatic day. It stays, and it is not a doctor pin. */
  anchor?: boolean;
  /** Doctor cleared this day. It is the rest. The mode does not change. */
  manualRest?: boolean;
};

export type PlannedBath = {
  ymd: string;
  seriesCode: string;
  procedureCode: string;
  mark: string;
  manual: boolean;
  locked: boolean;
  /** Sitting fill on the first session, full fill on the rest. */
  fill?: "OTURAQ" | "TAM" | null;
};

export function planBathSeries(input: {
  days: StayDay[];
  series: SeriesPlanInput[];
  kept: KeptCell[];
  /** continue = add quantity after the last saved bath. fresh = redraw automatic days around pins. */
  layout?: BathLayout;
  modes?: BathModeDef[];
}): PlannedBath[] {
  const placed: PlannedBath[] = [];
  const bathDays = new Set<string>();
  const ownCodes = new Set(input.series.map((row) => row.procedureCode));
  for (const cell of input.kept) {
    if (!ownCodes.has(cell.procedureCode) && cell.locked && !cell.manualRest) {
      bathDays.add(cell.ymd);
    }
  }

  const ordered = [...input.series].sort((a, b) => Number(a.fillsRestDays) - Number(b.fillsRestDays));
  for (const series of ordered) {
    const ownKept = input.kept.filter((cell) => cell.procedureCode === series.procedureCode);
    const keptBaths = ownKept.filter((cell) => cell.locked && !cell.manualRest);
    const restDays = new Set(ownKept.filter((cell) => cell.manualRest).map((cell) => cell.ymd));
    const keptByDay = new Map(keptBaths.map((cell) => [cell.ymd, cell]));
    const fresh = input.layout === "fresh";
    let used = 0;
    if (!fresh) {
      for (const cell of keptBaths) {
        if (bathDays.has(cell.ymd)) continue;
        placed.push({
          ymd: cell.ymd,
          seriesCode: series.seriesCode,
          procedureCode: series.procedureCode,
          mark: series.mark,
          manual: !cell.anchor,
          locked: true,
        });
        bathDays.add(cell.ymd);
        used += 1;
      }
    }
    const lastKept = fresh
      ? ""
      : keptBaths.reduce((max, cell) => (cell.ymd > max ? cell.ymd : max), "");
    const block = resolveBathBlock(series.mode, input.modes);
    let streak = 0;
    let restLeft = 0;
    const finishBlock = () => {
      streak += 1;
      if (streak >= block.baths) {
        streak = 0;
        restLeft = block.rest;
      }
    };
    for (const day of input.days) {
      if (fresh) {
        const pin = keptByDay.get(day.ymd);
        if (pin) {
          if (!bathDays.has(day.ymd) && used < series.qty) {
            placed.push({
              ymd: day.ymd,
              seriesCode: series.seriesCode,
              procedureCode: series.procedureCode,
              mark: series.mark,
              manual: true,
              locked: true,
            });
            bathDays.add(day.ymd);
            used += 1;
            finishBlock();
          }
          continue;
        }
      }
      if (lastKept && day.ymd <= lastKept) continue;
      if (used >= series.qty) break;
      if (!day.working) {
        if (restLeft === 0 && streak > 0) streak = 0;
        continue;
      }
      if (restDays.has(day.ymd)) {
        streak = 0;
        if (restLeft > 0) restLeft -= 1;
        continue;
      }
      if (restLeft > 0) {
        restLeft -= 1;
        streak = 0;
        continue;
      }
      if (bathDays.has(day.ymd)) continue;
      if (keptByDay.has(day.ymd)) continue;
      placed.push({
        ymd: day.ymd,
        seriesCode: series.seriesCode,
        procedureCode: series.procedureCode,
        mark: series.mark,
        manual: false,
        locked: false,
      });
      bathDays.add(day.ymd);
      used += 1;
      finishBlock();
    }
  }
  const orderedCells = placed.sort(
    (a, b) => a.ymd.localeCompare(b.ymd) || a.seriesCode.localeCompare(b.seriesCode),
  );
  for (const series of input.series) {
    if (!series.sitzThenFull) continue;
    const own = orderedCells.filter((cell) => cell.procedureCode === series.procedureCode);
    own.forEach((cell, index) => {
      cell.fill = index === 0 ? "OTURAQ" : "TAM";
    });
  }
  return orderedCells;
}

/**
 * A bath saved from the calendar used to be stamped with the procedure code,
 * while the package line uses the package quota. Those are the extra cards.
 * A session already checked in stays.
 */
export function strayBathOrderIds(
  orders: Array<{
    id: string;
    procedureCode: string;
    packageQuotaCode: string | null;
    status: string;
  }>,
): string[] {
  const byCode = new Map<string, typeof orders>();
  for (const order of orders) {
    const list = byCode.get(order.procedureCode) ?? [];
    list.push(order);
    byCode.set(order.procedureCode, list);
  }
  const ids: string[] = [];
  for (const [procedureCode, group] of byCode) {
    const packageQuota = group
      .map((row) => row.packageQuotaCode?.trim() || "")
      .find((code) => code && code !== procedureCode);
    if (!packageQuota) continue;
    for (const row of group) {
      if (row.status !== "SCHEDULED" && row.status !== "PROPOSED") continue;
      const quota = row.packageQuotaCode?.trim() || "";
      if (quota === procedureCode) ids.push(row.id);
    }
  }
  return ids;
}
