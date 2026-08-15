import { prisma } from "@/lib/prisma";

export type ShiftReportTotals = {
  receiptCount: number;
  voidCount: number;
  amountNet: number;
  amountGross: number;
  discountAmount: number;
  byMethod: Record<string, { count: number; amount: number }>;
  byChannel: Record<string, { count: number; amount: number }>;
};

function emptyTotals(): ShiftReportTotals {
  return {
    receiptCount: 0,
    voidCount: 0,
    amountNet: 0,
    amountGross: 0,
    discountAmount: 0,
    byMethod: {},
    byChannel: {},
  };
}

export async function computeShiftReport(shiftId: string): Promise<ShiftReportTotals> {
  const receipts = await prisma.clinicReceipt.findMany({
    where: { shiftId },
    include: { payments: true },
  });
  const totals = emptyTotals();
  for (const r of receipts) {
    if (r.status === "VOID") {
      totals.voidCount += 1;
      continue;
    }
    if (r.status !== "PAID") continue;
    totals.receiptCount += 1;
    totals.amountNet += Number(r.amountNet);
    totals.amountGross += Number(r.amountGross);
    totals.discountAmount += Number(r.discountAmount);
    const ch = r.channel;
    if (!totals.byChannel[ch]) totals.byChannel[ch] = { count: 0, amount: 0 };
    totals.byChannel[ch].count += 1;
    totals.byChannel[ch].amount += Number(r.amountNet);

    if (r.payments.length > 0) {
      for (const p of r.payments) {
        const m = p.method;
        if (!totals.byMethod[m]) totals.byMethod[m] = { count: 0, amount: 0 };
        totals.byMethod[m].count += 1;
        totals.byMethod[m].amount += Number(p.amount);
      }
    } else if (r.paymentMethod) {
      const m = r.paymentMethod;
      if (!totals.byMethod[m]) totals.byMethod[m] = { count: 0, amount: 0 };
      totals.byMethod[m].count += 1;
      totals.byMethod[m].amount += Number(r.amountNet);
    }
  }
  // round
  totals.amountNet = Math.round(totals.amountNet * 100) / 100;
  totals.amountGross = Math.round(totals.amountGross * 100) / 100;
  totals.discountAmount = Math.round(totals.discountAmount * 100) / 100;
  return totals;
}

export async function getCurrentShift() {
  return prisma.clinicShift.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

export async function openShift(userId?: string | null) {
  const existing = await getCurrentShift();
  if (existing) return existing;
  return prisma.clinicShift.create({
    data: {
      code: `SHIFT-${Date.now()}`,
      status: "OPEN",
      openedByUserId: userId ?? null,
    },
  });
}

export async function closeShift(shiftId: string, userId?: string | null) {
  const shift = await prisma.clinicShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new Error("Shift not found");
  if (shift.status !== "OPEN") throw new Error("Shift already closed");
  const report = await computeShiftReport(shiftId);
  return prisma.clinicShift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByUserId: userId ?? null,
      zReportJson: JSON.stringify(report),
    },
  });
}
