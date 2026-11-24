/**
 * Lay day-series cells across a stay (universal — not bath-SKU-specific).
 * A block is N working sessions then R rest days from the series mode
 * (`resolveBathBlock`: 2+1, 3+1, 5+1, … — same loop, different numbers).
 * Closed-day and weekly-cap behaviour come from BathPlanPolicy.
 * One hard-series session per day. fillsRestDays series may use an empty day.
 *
 * Contract: rhythm beats qty and stay end. Never skip owed rest to squeeze
 * more sessions into a short horizon; leftover qty stays unplaced.
 * Locked / manual cells stay. Extra quantity continues after the last kept cell.
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

/**
 * Rest days of one bath series, counted from its first remaining bath.
 * The anchor day is a bath. Later working days follow the mode. Closed days
 * use the same clinic policy as `planBathSeries`.
 *
 * When `countYmds` is set (fact / continue): only those days advance the
 * hard-series streak. A working day outside the set breaks the streak (foreign
 * hydro/iodine or a gap) — it is not treated as a virtual bath day and does
 * not earn calendar rest. Omit `countYmds` for the legacy “every working day
 * is a bath slot” projection used by older unit fixtures.
 */
export function bathSeriesRestYmds(input: {
  days: StayDay[];
  anchorYmd: string;
  mode: string;
  modes?: BathModeDef[];
  policy?: Partial<BathPlanPolicy>;
  /** Own hard-series bath YMDs already on the board (fact). */
  countYmds?: ReadonlySet<string>;
}): string[] {
  const policy = resolveBathPlanPolicy(input.policy);
  const block = resolveBathBlock(input.mode, input.modes);
  const countOnly = input.countYmds;
  const rest: string[] = [];
  let streak = 0;
  let restLeft = 0;
  let started = false;
  const finishBlock = () => {
    streak += 1;
    if (streak >= block.baths) {
      streak = 0;
      restLeft = block.rest;
    }
  };
  const breakStreak = () => {
    streak = 0;
    restLeft = 0;
  };
  for (const day of input.days) {
    if (day.ymd < input.anchorYmd) continue;
    if (!started) {
      started = true;
      if (day.working) {
        if (!countOnly || countOnly.has(day.ymd)) finishBlock();
        else breakStreak();
      }
      continue;
    }
    if (!day.working) {
      if (restLeft > 0 && policy.closedDaySpendsOwedRest) {
        restLeft -= 1;
        streak = 0;
      } else if (restLeft === 0 && streak > 0 && policy.closedDayResetsOpenStreak) {
        streak = 0;
      }
      continue;
    }
    if (restLeft > 0) {
      rest.push(day.ymd);
      restLeft -= 1;
      streak = 0;
      continue;
    }
    if (countOnly) {
      if (countOnly.has(day.ymd)) finishBlock();
      else breakStreak();
      continue;
    }
    finishBlock();
  }
  return rest;
}

/** Other naftalan baths already sitting in the target Baku week. Cap 0 disables the limit. */
export function naftalanWeekIsFull(targetYmd: string, otherYmds: string[], cap: number): boolean {
  if (cap <= 0) return false;
  const week = bakuMondayYmd(targetYmd);
  return otherYmds.filter((ymd) => bakuMondayYmd(ymd) === week).length >= cap;
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
  /** Per-series weekly cap; null/undefined = use policy.weeklyNaftalanCap; 0 = off. */
  weeklyCap?: number | null;
  /** First kept-or-placed session is sitting fill, the rest are full. Same series. */
  sitzThenFull?: boolean;
};

/**
 * Next working day at/after `fromYmd` that is not a recomputed rest day, not used,
 * and under the weekly cap. Rest comes from mode+anchor (not only stored restYmds).
 */
export function nextLegalSeriesDay(input: {
  days: StayDay[];
  fromYmd: string;
  mode: string;
  modes?: BathModeDef[];
  policy?: Partial<BathPlanPolicy>;
  /** First seated/planned bath of this streak; omit → no rest until a bath exists. */
  anchorYmd?: string | null;
  usedYmds: Set<string>;
  /** Cap for this series (!fillsRestDays). 0 = off. */
  weeklyCap: number;
  /** Other hard-series bath YMDs already counting toward the week. */
  weekBathYmds: string[];
  fillsRestDays: boolean;
  /** Exclusive stay end YMD (checkout). */
  stayEndYmd?: string | null;
}): string | null {
  const rest = new Set(
    input.anchorYmd
      ? bathSeriesRestYmds({
          days: input.days,
          anchorYmd: input.anchorYmd,
          mode: input.mode,
          modes: input.modes,
          policy: input.policy,
          // Own hard-series baths only — do not treat foreign occupied days as streak baths.
          countYmds: new Set(
            input.weekBathYmds.length > 0 ? input.weekBathYmds : [...input.usedYmds],
          ),
        })
      : [],
  );
  for (const day of input.days) {
    if (day.ymd < input.fromYmd) continue;
    if (input.stayEndYmd && day.ymd >= input.stayEndYmd) break;
    if (!day.working) continue;
    if (input.usedYmds.has(day.ymd)) continue;
    if (rest.has(day.ymd)) continue;
    if (
      !input.fillsRestDays &&
      naftalanWeekIsFull(day.ymd, input.weekBathYmds, input.weeklyCap)
    ) {
      continue;
    }
    return day.ymd;
  }
  return null;
}

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

/**
 * Live same-SKU days already on the stay.
 * Prefer counting them as locked kept (and in qty) via `saxlaSameSkuKept` so mode rest
 * continues across the full set. Using only this list as `blockedDays` skips streak/rest
 * updates and lets a +1 land in a hole (Irina-class).
 */
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

const SAXLA_PINNED_STATUSES = new Set(["CHECKED_IN", "COMPLETED"]);

/** Same-SKU live days as locked kept cells (count toward qty + mode streak). */
export function saxlaSameSkuKept(
  orders: Array<{ id: string; ymd: string; procedureCode: string }>,
  seatingIds: ReadonlySet<string>,
  seatingCodes: ReadonlySet<string>,
): KeptCell[] {
  return orders
    .filter((order) => !seatingIds.has(order.id) && seatingCodes.has(order.procedureCode))
    .map((order) => ({
      ymd: order.ymd,
      procedureCode: order.procedureCode,
      locked: true,
    }));
}

/**
 * Same-SKU kept for Saxla day-series seating.
 * continue = every live same-SKU day is locked.
 * fresh = only past days and checked-in/completed (future SCHEDULED may replan).
 */
export function saxlaSameSkuKeptForSaxla(
  orders: Array<{ id: string; ymd: string; procedureCode: string; status?: string }>,
  seatingIds: ReadonlySet<string>,
  seatingCodes: ReadonlySet<string>,
  layout: BathLayout,
  notBeforeYmd: string,
): KeptCell[] {
  if (layout === "continue") {
    return saxlaSameSkuKept(orders, seatingIds, seatingCodes);
  }
  return orders
    .filter((order) => {
      if (seatingIds.has(order.id) || !seatingCodes.has(order.procedureCode)) return false;
      if (order.status && SAXLA_PINNED_STATUSES.has(order.status)) return true;
      return order.ymd < notBeforeYmd;
    })
    .map((order) => ({
      ymd: order.ymd,
      procedureCode: order.procedureCode,
      locked: true,
    }));
}

/**
 * Max run of consecutive working days that all have a bath.
 * Closed days break the streak (same as clinic week template).
 */
export function hardSeriesMaxWorkingStreak(bathYmds: string[], days: StayDay[]): number {
  const set = new Set(bathYmds);
  if (set.size === 0 || days.length === 0) return 0;
  let max = 0;
  let cur = 0;
  for (const day of days) {
    if (!day.working) {
      cur = 0;
      continue;
    }
    if (set.has(day.ymd)) {
      cur += 1;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

/**
 * Bath YMDs that break hard-series mode: sit on a recomputed rest day, or push
 * working streak above mode.baths. fillsRestDays series are not checked.
 */
export function illegalHardSeriesBathYmds(input: {
  bathYmds: string[];
  days: StayDay[];
  mode: string;
  modes?: BathModeDef[];
  policy?: Partial<BathPlanPolicy>;
  fillsRestDays?: boolean;
}): string[] {
  if (input.fillsRestDays) return [];
  const sorted = [...new Set(input.bathYmds)].sort();
  if (sorted.length === 0) return [];
  const block = resolveBathBlock(input.mode, input.modes);
  const illegal = new Set<string>();
  const anchorYmd = sorted[0]!;
  const ownSet = new Set(sorted);
  const rest = new Set(
    bathSeriesRestYmds({
      days: input.days,
      anchorYmd,
      mode: input.mode,
      modes: input.modes,
      policy: input.policy,
      countYmds: ownSet,
    }),
  );
  for (const ymd of sorted) {
    if (rest.has(ymd)) illegal.add(ymd);
  }
  if (hardSeriesMaxWorkingStreak(sorted, input.days) > block.baths) {
    let cur: string[] = [];
    for (const day of input.days) {
      if (!day.working) {
        cur = [];
        continue;
      }
      if (sorted.includes(day.ymd)) {
        cur.push(day.ymd);
        if (cur.length > block.baths) {
          for (const y of cur.slice(block.baths)) illegal.add(y);
        }
      } else {
        cur = [];
      }
    }
  }
  return [...illegal].sort();
}

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
  const hardSeriesByCode = new Map(
    input.series
      .filter((row) => !row.fillsRestDays)
      .map((row) => [row.procedureCode, row] as const),
  );
  /** Per seriesCode + Baku week → count (weekly cap is per series). */
  const weekCount = new Map<string, number>();
  const capFor = (procedureCode: string) => {
    const series = hardSeriesByCode.get(procedureCode);
    if (!series) return 0;
    if (series.weeklyCap === null || series.weeklyCap === undefined) {
      return policy.weeklyNaftalanCap;
    }
    return clampWeeklyNaftalanCap(series.weeklyCap);
  };
  const bumpNaftalanWeek = (ymd: string, procedureCode: string) => {
    const series = hardSeriesByCode.get(procedureCode);
    if (!series) return;
    const week = bakuMondayYmd(ymd);
    const key = `${series.seriesCode}|${week}`;
    weekCount.set(key, (weekCount.get(key) ?? 0) + 1);
  };
  const weekAtCap = (ymd: string, procedureCode: string) => {
    const series = hardSeriesByCode.get(procedureCode);
    if (!series) return false;
    const cap = capFor(procedureCode);
    if (cap <= 0) return false;
    const key = `${series.seriesCode}|${bakuMondayYmd(ymd)}`;
    return (weekCount.get(key) ?? 0) >= cap;
  };
  const placed: PlannedBath[] = [];
  const bathDays = new Set<string>();
  const ownCodes = new Set(input.series.map((row) => row.procedureCode));
  for (const cell of input.kept) {
    if (cell.locked && !cell.manualRest && hardSeriesByCode.has(cell.procedureCode)) {
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
    const breakHardStreak = () => {
      streak = 0;
      restLeft = 0;
    };
    const replaySeatedDay = (day: StayDay) => {
      if (!day.working) {
        if (restLeft > 0 && policy.closedDaySpendsOwedRest) {
          restLeft -= 1;
          streak = 0;
        } else if (restLeft === 0 && streak > 0 && policy.closedDayResetsOpenStreak) {
          streak = 0;
        }
        return;
      }
      if (restDays.has(day.ymd)) {
        streak = 0;
        if (restLeft > 0) restLeft -= 1;
        return;
      }
      if (restLeft > 0) {
        restLeft -= 1;
        streak = 0;
        return;
      }
      if (blockedOwn.has(day.ymd) || keptByDay.has(day.ymd)) {
        finishBlock();
        return;
      }
      // Hard series only: foreign cabin-day or gap between own baths breaks streak.
      // fillsRestDays (hydro/iodine) only skips the occupied day — do not reset its cadence.
      if (!series.fillsRestDays) {
        if (bathDays.has(day.ymd) || day.ymd <= lastKept) {
          breakHardStreak();
        }
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
            if (pastPin) finishBlock();
          }
          continue;
        }
      }
      if (input.notBeforeYmd && day.ymd < input.notBeforeYmd) {
        replaySeatedDay(day);
        continue;
      }
      if (lastKept && day.ymd <= lastKept) {
        replaySeatedDay(day);
        continue;
      }
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
      if (bathDays.has(day.ymd)) {
        // Foreign bath breaks hard-series streak only; fills-rest just skips the day.
        if (!series.fillsRestDays) breakHardStreak();
        continue;
      }
      if (keptByDay.has(day.ymd)) continue;
      if (!series.fillsRestDays && weekAtCap(day.ymd, series.procedureCode)) continue;
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
