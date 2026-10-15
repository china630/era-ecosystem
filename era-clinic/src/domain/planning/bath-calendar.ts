/**
 * Lay bath-series cells across a stay.
 * A block of N is N working baths, then one rest. A closed day inside a streak is that rest.
 * One bath per day. Series with fillsRestDays may use a day another series left empty.
 * Locked and manual cells stay. Extra quantity continues after the last kept cell.
 */

export type BathMode = "2" | "3" | "5" | "ALTERNATING";

export type StayDay = {
  ymd: string;
  working: boolean;
};

export type SeriesPlanInput = {
  seriesCode: string;
  procedureCode: string;
  mark: string;
  mode: BathMode;
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

function blockSize(mode: BathMode): number {
  if (mode === "ALTERNATING") return 1;
  return Number(mode);
}

export function planBathSeries(input: {
  days: StayDay[];
  series: SeriesPlanInput[];
  kept: KeptCell[];
  /** continue = add quantity after the last saved bath. fresh = redraw automatic days around pins. */
  layout?: BathLayout;
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
    let streak = 0;
    let needRest = false;
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
            streak += 1;
            if (streak >= blockSize(series.mode)) {
              streak = 0;
              needRest = true;
            }
          }
          continue;
        }
      }
      if (lastKept && day.ymd <= lastKept) continue;
      if (used >= series.qty) break;
      if (needRest) {
        needRest = false;
        streak = 0;
        continue;
      }
      if (restDays.has(day.ymd)) {
        streak = 0;
        continue;
      }
      if (!day.working) {
        if (streak > 0) streak = 0;
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
      streak += 1;
      if (streak >= blockSize(series.mode)) {
        streak = 0;
        needRest = true;
      }
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
