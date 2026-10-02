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

/** Shift whose drawer interval contains `at`. Pay uses requireOpenShift; other closes must not fail when the drawer is already shut. */
export async function shiftIdCovering(outletId: string, at: Date): Promise<string | null> {
  const shift = await prisma.posShift.findFirst({
    where: {
      outletId,
      openedAt: { lte: at },
      OR: [{ closedAt: null }, { closedAt: { gte: new Date(at.getTime() - 1000) } }],
    },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
  return shift?.id ?? null;
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
