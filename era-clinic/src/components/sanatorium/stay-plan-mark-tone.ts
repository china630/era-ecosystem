/**
 * Stay-day grid mark colors — package vs unpaid extra vs paid extra.
 * "Done" is a green ring overlay so money lane (package vs paid extra) stays visible.
 */

export type StayPlanMoneyTone = "paid" | "unpaidExtra" | "package";

/** @deprecated Prefer stayPlanMoneyTone + done ring; kept for rank helpers. */
export type StayPlanMarkTone = "done" | StayPlanMoneyTone;

const MONEY_RANK: Record<StayPlanMoneyTone, number> = {
  package: 0,
  unpaidExtra: 1,
  paid: 2,
};

export function stayPlanMoneyTone(mark: {
  paid: boolean;
  inPackage: boolean;
}): StayPlanMoneyTone {
  if (mark.paid) return "paid";
  if (!mark.inPackage) return "unpaidExtra";
  return "package";
}

/** Legacy helper: done no longer replaces money fill — callers should use stayPlanDotClass. */
export function stayPlanMarkTone(mark: {
  done: boolean;
  paid: boolean;
  inPackage: boolean;
}): StayPlanMarkTone {
  if (mark.done) return "done";
  return stayPlanMoneyTone(mark);
}

/** One cell can hold package + extra same day — show the strongest money tone. */
export function pickStayPlanMarkForDay<
  T extends { ymd: string; done: boolean; paid: boolean; inPackage: boolean },
>(marks: T[], ymd: string): T | undefined {
  let best: T | undefined;
  let bestRank = -1;
  for (const mark of marks) {
    if (mark.ymd !== ymd) continue;
    const rank = MONEY_RANK[stayPlanMoneyTone(mark)] * 2 + (mark.done ? 1 : 0);
    if (rank > bestRank) {
      best = mark;
      bestRank = rank;
    }
  }
  return best;
}

/** All marks on a day (for tooltip when package + extra share a cell). */
export function stayPlanMarksForDay<T extends { ymd: string }>(marks: T[], ymd: string): T[] {
  return marks.filter((mark) => mark.ymd === ymd);
}

/** Tailwind classes — filled disc + thin ring for contrast. */
export const STAY_PLAN_MONEY_DOT_CLASS: Record<StayPlanMoneyTone, string> = {
  package: "bg-[#1F4E79] ring-1 ring-white",
  unpaidExtra: "bg-[#C0392B] ring-1 ring-white",
  paid: "bg-[#D4A017] ring-1 ring-[#1F4E79]/40",
};

/** Green ring when session is done — keeps money fill. */
export const STAY_PLAN_DONE_RING_CLASS = "outline outline-2 outline-offset-1 outline-[#196F3D]";

export function stayPlanDotClass(mark: {
  done: boolean;
  paid: boolean;
  inPackage: boolean;
}): string {
  const money = STAY_PLAN_MONEY_DOT_CLASS[stayPlanMoneyTone(mark)];
  return mark.done ? `${money} ${STAY_PLAN_DONE_RING_CLASS}` : money;
}

/** @deprecated Use STAY_PLAN_MONEY_DOT_CLASS + stayPlanDotClass. */
export const STAY_PLAN_MARK_DOT_CLASS: Record<StayPlanMarkTone, string> = {
  ...STAY_PLAN_MONEY_DOT_CLASS,
  done: `bg-[#1F4E79] ring-1 ring-white ${STAY_PLAN_DONE_RING_CLASS}`,
};
