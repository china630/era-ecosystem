/**
 * Lay bath-series cells across a stay.
 * A block is N working baths, then R rest days. Closed-day and weekly-cap
 * behaviour come from BathPlanPolicy (clinic settings). One bath per day.
 * Series with fillsRestDays may use a day another series left empty.
 * Locked and manual cells stay. Extra quantity continues after the last kept cell.
 */

import { addBakuDays } from "@era/satellite-kit/time";

export type BathMode = "2" | "3" | "4" | "5" | "ALTERNATING";

export type BathModeDef = {
  code: string;
  baths: number;
  rest: number;
};

export const DEFAULT_BATH_MODES: BathModeDef[] = [
  { code: "2", baths: 2, rest: 1 },
  { code: "3", baths: 3, rest: 1 },
  { code: "4", baths: 4, rest: 1 },
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
  const list = out.length > 0 ? out : [...DEFAULT_BATH_MODES];
  const have = new Set(list.map((row) => row.code));
  for (const builtin of DEFAULT_BATH_MODES) {
    if (have.has(builtin.code)) continue;
    const builtinIndex = DEFAULT_BATH_MODES.findIndex((row) => row.code === builtin.code);
    let insertAt = list.length;
    for (let i = builtinIndex - 1; i >= 0; i--) {
      const pos = list.findIndex((row) => row.code === DEFAULT_BATH_MODES[i]!.code);
      if (pos >= 0) {
        insertAt = pos + 1;
        break;
      }
    }
    list.splice(insertAt, 0, builtin);
  }
  return list;
}

export type BathPlanPolicy = {
  closedDaySpendsOwedRest: boolean;
  closedDayResetsOpenStreak: boolean;
  weeklyNaftalanCap: number;
};

export const DEFAULT_BATH_PLAN_POLICY: BathPlanPolicy = {
  closedDaySpendsOwedRest: true,
  closedDayResetsOpenStreak: true,
  weeklyNaftalanCap: 5,
};

export function clampWeeklyNaftalanCap(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BATH_PLAN_POLICY.weeklyNaftalanCap;
  return Math.min(14, Math.max(0, Math.floor(n)));
}

export function resolveBathPlanPolicy(input?: Partial<BathPlanPolicy> | null): BathPlanPolicy {
  return {
    closedDaySpendsOwedRest: input?.closedDaySpendsOwedRest !== false,
    closedDayResetsOpenStreak: input?.closedDayResetsOpenStreak !== false,
    weeklyNaftalanCap: clampWeeklyNaftalanCap(
      input?.weeklyNaftalanCap ?? DEFAULT_BATH_PLAN_POLICY.weeklyNaftalanCap,
    ),
  };
}

export function resolveDefaultBathMode(
  mode: string | null | undefined,
  modes: BathModeDef[] = DEFAULT_BATH_MODES,
): string {
  const code = String(mode ?? "").trim().toUpperCase();
  if (modes.some((row) => row.code === code)) return code;
  if (modes.some((row) => row.code === "3")) return "3";
  return modes[0]?.code ?? "3";
}

/** Monday YMD of the Baku week that contains `ymd`. */
export function bakuMondayYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const noon = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baku",
    weekday: "short",
  }).format(noon);
  const index: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = index[short] ?? 0;
  const back = weekday === 0 ? 6 : weekday - 1;
  return addBakuDays(ymd, -back);
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

/** Other-series live days occupy a date. The PROPOSED rows this Saxla is seating do not. */
export function saxlaSeatKept(
  orders: Array<{ id: string; ymd: string; procedureCode: string }>,
  seatingIds: ReadonlySet<string>,
  seatingCodes: ReadonlySet<string>,
): KeptCell[] {
  return orders
    .filter((order) => !seatingIds.has(order.id) && !seatingCodes.has(order.procedureCode))
    .map((order) => ({
      ymd: order.ymd,
      procedureCode: order.procedureCode,
      locked: true,
    }));
}

export function saxlaDayTaken(
  orders: Array<{ id: string; ymd: string; procedureCode: string }>,
  seatingIds: ReadonlySet<string>,
  procedureCode: string,
  ymd: string,
): boolean {
  return orders.some(
    (order) =>
      !seatingIds.has(order.id) && order.procedureCode === procedureCode && order.ymd === ymd,
  );
}

/** Live same-SKU days already on the stay. Occupy the date without spending new qty. */
export function saxlaBlockedDays(
  orders: Array<{ id: string; ymd: string; procedureCode: string }>,
  seatingIds: ReadonlySet<string>,
  seatingCodes: ReadonlySet<string>,
): Array<{ ymd: string; procedureCode: string }> {
  return orders
    .filter((order) => !seatingIds.has(order.id) && seatingCodes.has(order.procedureCode))
    .map((order) => ({ ymd: order.ymd, procedureCode: order.procedureCode }));
}

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
  /** Civil days strictly before this YMD are never given a new automatic bath. */
  notBeforeYmd?: string;
  /** Occupied dates (existing same SKU). Skip without counting toward new qty. */
  blockedDays?: Array<{ ymd: string; procedureCode: string }>;
  policy?: Partial<BathPlanPolicy>;
}): PlannedBath[] {
  const policy = resolveBathPlanPolicy(input.policy);
  const naftalanCodes = new Set(
    input.series.filter((row) => !row.fillsRestDays).map((row) => row.procedureCode),
  );
  const weekCount = new Map<string, number>();
  const bumpNaftalanWeek = (ymd: string, procedureCode: string) => {
    if (!naftalanCodes.has(procedureCode)) return;
    const week = bakuMondayYmd(ymd);
    weekCount.set(week, (weekCount.get(week) ?? 0) + 1);
  };
  const weekAtCap = (ymd: string) =>
    policy.weeklyNaftalanCap > 0 &&
    (weekCount.get(bakuMondayYmd(ymd)) ?? 0) >= policy.weeklyNaftalanCap;
  const placed: PlannedBath[] = [];
  const bathDays = new Set<string>();
  const ownCodes = new Set(input.series.map((row) => row.procedureCode));
  for (const cell of input.kept) {
    if (cell.locked && !cell.manualRest && naftalanCodes.has(cell.procedureCode)) {
      bumpNaftalanWeek(cell.ymd, cell.procedureCode);
    }
    if (!ownCodes.has(cell.procedureCode) && cell.locked && !cell.manualRest) {
      bathDays.add(cell.ymd);
    }
  }
  for (const block of input.blockedDays ?? []) {
    bathDays.add(block.ymd);
    bumpNaftalanWeek(block.ymd, block.procedureCode);
  }

  const ordered = [...input.series].sort((a, b) => Number(a.fillsRestDays) - Number(b.fillsRestDays));
  for (const series of ordered) {
    const ownKept = input.kept.filter((cell) => cell.procedureCode === series.procedureCode);
    const keptBaths = ownKept.filter((cell) => cell.locked && !cell.manualRest);
    const restDays = new Set(ownKept.filter((cell) => cell.manualRest).map((cell) => cell.ymd));
    const keptByDay = new Map(keptBaths.map((cell) => [cell.ymd, cell]));
    const blockedOwn = new Set(
      (input.blockedDays ?? [])
        .filter((row) => row.procedureCode === series.procedureCode)
        .map((row) => row.ymd),
    );
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
          const pastPin = Boolean(input.notBeforeYmd && day.ymd < input.notBeforeYmd);
          if (!bathDays.has(day.ymd) && (pastPin || used < series.qty)) {
            placed.push({
              ymd: day.ymd,
              seriesCode: series.seriesCode,
              procedureCode: series.procedureCode,
              mark: series.mark,
              manual: true,
              locked: true,
            });
            bathDays.add(day.ymd);
            if (!pastPin) {
              used += 1;
              finishBlock();
            } else if (used < series.qty) {
              used += 1;
            }
          }
          continue;
        }
      }
      if (input.notBeforeYmd && day.ymd < input.notBeforeYmd) continue;
      if (lastKept && day.ymd <= lastKept) continue;
      if (used >= series.qty) break;
      if (!day.working) {
        if (restLeft > 0 && policy.closedDaySpendsOwedRest) {
          restLeft -= 1;
          streak = 0;
        } else if (restLeft === 0 && streak > 0 && policy.closedDayResetsOpenStreak) {
          streak = 0;
        }
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
      if (blockedOwn.has(day.ymd)) {
        finishBlock();
        continue;
      }
      if (bathDays.has(day.ymd)) continue;
      if (keptByDay.has(day.ymd)) continue;
      if (!series.fillsRestDays && weekAtCap(day.ymd)) continue;
      placed.push({
        ymd: day.ymd,
        seriesCode: series.seriesCode,
        procedureCode: series.procedureCode,
        mark: series.mark,
        manual: false,
        locked: false,
      });
      bathDays.add(day.ymd);
      bumpNaftalanWeek(day.ymd, series.procedureCode);
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
