import { prisma } from "@/lib/prisma";
import { revenueCodeForServiceLine } from "@/lib/billing-router";
import { accumulateRevenue, type RevenueRow } from "@/domain/reports/revenue-statement";

/** Paid extras, paid lab lines, and paid visit lines in the Baku day window. */
export async function loadRevenueStatement(start: Date, end: Date): Promise<RevenueRow[]> {
  const [extras, labItems, visitLines] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: {
        inPackage: false,
        amountNet: { gt: 0 },
        paymentReceiptRef: { not: null },
        status: { not: "CANCELLED" },
        scheduledAt: { gte: start, lt: end },
      },
      select: { procedureCode: true, quantity: true, amountNet: true },
    }),
    prisma.labOrderItem.findMany({
      where: {
        inPackage: false,
        amountNet: { gt: 0 },
        labOrder: {
          status: { not: "CANCELLED" },
          OR: [
            { settledAt: { gte: start, lt: end } },
            {
              settledAt: null,
              settlementPendingId: { not: null },
              createdAt: { gte: start, lt: end },
            },
          ],
        },
      },
      select: { serviceCode: true, amountNet: true },
    }),
    prisma.visitServiceLine.findMany({
      where: {
        inPackage: false,
        amount: { gt: 0 },
        visit: {
          status: { not: "CANCELLED" },
          OR: [
            { settledAt: { gte: start, lt: end } },
            {
              settledAt: null,
              settlementPendingId: { not: null },
              createdAt: { gte: start, lt: end },
            },
          ],
        },
      },
      select: { serviceCode: true, amount: true },
    }),
  ]);

  const serviceCodes = [
    ...new Set([
      ...extras.map((row) => row.procedureCode),
      ...labItems.map((row) => row.serviceCode),
      ...visitLines.map((row) => row.serviceCode),
    ]),
  ];
  const revenueByService = new Map<string, string>();
  for (const code of serviceCodes) {
    revenueByService.set(code, await revenueCodeForServiceLine(code));
  }
  const article = (code: string) => revenueByService.get(code) ?? "";

  return accumulateRevenue([
    ...extras.map((row) => ({
      revenueCode: article(row.procedureCode),
      quantity: row.quantity || 1,
      amount: row.amountNet.toNumber(),
    })),
    ...labItems.map((row) => ({
      revenueCode: article(row.serviceCode),
      quantity: 1,
      amount: row.amountNet.toNumber(),
    })),
    ...visitLines.map((row) => ({
      revenueCode: article(row.serviceCode),
      quantity: 1,
      amount: row.amount.toNumber(),
    })),
  ]);
}
