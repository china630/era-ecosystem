/**
 * Stay-day grid mark colors — package vs unpaid extra vs paid extra vs done.
 * Dots sit on neutral day tones (no heat underlay) so amber/red stay readable.
 */

export type StayPlanMarkTone = "done" | "paid" | "unpaidExtra" | "package";

const TONE_RANK: Record<StayPlanMarkTone, number> = {
  package: 0,
  unpaidExtra: 1,
  paid: 2,
  done: 3,
};

export function stayPlanMarkTone(mark: {
  done: boolean;
  paid: boolean;
  inPackage: boolean;
}): StayPlanMarkTone {
  if (mark.done) return "done";
  if (mark.paid) return "paid";
  if (!mark.inPackage) return "unpaidExtra";
  return "package";
}

/** One cell can hold package + extra same day — show the strongest tone. */
export function pickStayPlanMarkForDay<T extends { ymd: string; done: boolean; paid: boolean; inPackage: boolean }>(
  marks: T[],
  ymd: string,
): T | undefined {
  let best: T | undefined;
  let bestRank = -1;
  for (const mark of marks) {
    if (mark.ymd !== ymd) continue;
    const rank = TONE_RANK[stayPlanMarkTone(mark)];
    if (rank > bestRank) {
      best = mark;
      bestRank = rank;
    }
  }
  return best;
}

/** Tailwind classes — filled disc + thin white ring for contrast. */
export const STAY_PLAN_MARK_DOT_CLASS: Record<StayPlanMarkTone, string> = {
  package: "bg-[#1A5276] ring-1 ring-white",
  unpaidExtra: "bg-[#C0392B] ring-1 ring-white",
  paid: "bg-[#D4A017] ring-1 ring-[#1A5276]/40",
  done: "bg-[#196F3D] ring-1 ring-white",
};
