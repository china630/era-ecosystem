import { prisma } from "@/lib/prisma";

export class ShiftRequiredError extends Error {
  readonly code = "SHIFT_REQUIRED";

  constructor() {
    super("Open a shift before selling");
    this.name = "ShiftRequiredError";
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
