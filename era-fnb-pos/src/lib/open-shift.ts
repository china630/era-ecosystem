import { prisma } from "@/lib/prisma";
import { isShiftStale } from "@/lib/business-day";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";

export class ShiftRequiredError extends Error {
  readonly code = "SHIFT_REQUIRED";

  constructor() {
    super("Open a shift before selling");
    this.name = "ShiftRequiredError";
  }
}

export class ShiftStaleError extends Error {
  readonly code = "SHIFT_STALE";

  constructor() {
    super("Close the previous business day before opening new checks");
    this.name = "ShiftStaleError";
  }
}

export async function requireOpenShift(outletId: string) {
  const shift = await prisma.posShift.findFirst({
    where: { outletId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  if (!shift) throw new ShiftRequiredError();
  return shift;
}

/** Open shift that still belongs to the current business day. Pay of existing checks stays on requireOpenShift. */
export async function requireCurrentShift(outletId: string) {
  const shift = await requireOpenShift(outletId);
  const profile = await getFnbOrgProfile();
  if (isShiftStale(shift.openedAt, new Date(), profile.businessDayStart)) {
    throw new ShiftStaleError();
  }
  return shift;
}
