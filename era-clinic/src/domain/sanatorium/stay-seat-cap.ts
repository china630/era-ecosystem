/**
 * Max OPEN (and soft) seat qty = working days from today through day before checkout,
 * minus days already holding this procedure code.
 */
import { prisma } from "@/lib/prisma";
import { addBakuDays, bakuDateKey, todayBakuYmd } from "@/lib/baku-day";

export type StaySeatCap = {
  /** Working days available for a new OPEN pin of this code (0 when none). */
  remainingSeatDays: number;
  /** Inclusive working-day horizon used (today … last). */
  horizonStartYmd: string;
  horizonEndYmd: string | null;
  checkoutYmd: string | null;
};

/** Working days today … checkout−1 (Asia/Baku). Checkout day is not in the default pin horizon. */
export async function countRemainingOpenSeatDays(
  episodeId: string,
  procedureCode?: string | null,
): Promise<StaySeatCap> {
  const empty: StaySeatCap = {
    remainingSeatDays: 0,
    horizonStartYmd: todayBakuYmd(),
    horizonEndYmd: null,
    checkoutYmd: null,
  };
  const instance = await prisma.programInstance.findFirst({
    where: { episodeId },
    select: { endsOn: true, startsOn: true },
  });
  if (!instance?.endsOn) return empty;
  const checkoutYmd = bakuDateKey(instance.endsOn);
  const today = todayBakuYmd();
  const horizonEndYmd = addBakuDays(checkoutYmd, -1);
  if (horizonEndYmd < today) {
    return { ...empty, checkoutYmd, horizonEndYmd };
  }
  const { listClinicDays } = await import("@/domain/planning/clinic-day");
  const clinicDays = await listClinicDays(today, horizonEndYmd);
  const working = clinicDays.filter((d) => d.working).map((d) => d.ymd);
  if (working.length === 0) {
    return { remainingSeatDays: 0, horizonStartYmd: today, horizonEndYmd, checkoutYmd };
  }
  const occupied = new Set<string>();
  if (procedureCode) {
    const live = await prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: episodeId,
        procedureCode,
        status: { notIn: ["CANCELLED", "UNPAID_MISSED"] },
        schedulingMode: "OPEN",
      },
      select: { scheduledAt: true },
    });
    for (const row of live) {
      const ymd = bakuDateKey(row.scheduledAt);
      if (ymd >= today && ymd <= horizonEndYmd) occupied.add(ymd);
    }
  }
  const free = working.filter((ymd) => !occupied.has(ymd)).length;
  return {
    remainingSeatDays: free,
    horizonStartYmd: today,
    horizonEndYmd,
    checkoutYmd,
  };
}

/** Soft calendar cap when code is FIXED (no per-day OPEN occupancy): working days left in horizon. */
export async function countRemainingStayWorkingDays(episodeId: string): Promise<number> {
  const cap = await countRemainingOpenSeatDays(episodeId, null);
  return cap.remainingSeatDays;
}
