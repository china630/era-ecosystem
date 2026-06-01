import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recalcWorkOrderTotals(workOrderId: string) {
  const [labor, parts] = await Promise.all([
    prisma.workOrderLaborLine.aggregate({
      where: { workOrderId },
      _sum: { amountAzn: true },
    }),
    prisma.workOrderPartLine.aggregate({
      where: { workOrderId },
      _sum: { amountAzn: true },
    }),
  ]);
  const laborAmount = Number(labor._sum.amountAzn ?? 0);
  const partsAmount = Number(parts._sum.amountAzn ?? 0);
  return prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      laborAmount: new Prisma.Decimal(laborAmount),
      partsAmount: new Prisma.Decimal(partsAmount),
    },
    include: { laborLines: true, partLines: true, vehicle: true },
  });
}

export function lineAmount(qty: number, unit: number): number {
  return Math.round(qty * unit * 100) / 100;
}
