import { prisma } from "@/lib/prisma";

export function listImportPurchaseOrders(take = 100) {
  return prisma.importPurchaseOrder.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function createImportPurchaseOrder(data: {
  externalRef: string;
  supplierCounterpartyId?: string;
  supplierVoen?: string;
  currencyCode: string;
  amountForeign: number;
  paymentTermDays: number;
  dueDate: Date;
  lines: { sku: string; quantity: number; unitPriceForeign?: number }[];
}) {
  return prisma.importPurchaseOrder.create({
    data: {
      externalRef: data.externalRef,
      supplierCounterpartyId: data.supplierCounterpartyId,
      supplierVoen: data.supplierVoen,
      currencyCode: data.currencyCode,
      amountForeign: data.amountForeign,
      paymentTermDays: data.paymentTermDays,
      dueDate: data.dueDate,
      lines: {
        create: data.lines.map((l) => ({
          sku: l.sku,
          quantity: l.quantity,
          unitPriceForeign: l.unitPriceForeign,
        })),
      },
    },
    include: { lines: true },
  });
}

export function findImportPurchaseOrderById(id: string) {
  return prisma.importPurchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
}

export function confirmImportPurchaseOrder(
  id: string,
  financePurchaseRef: string,
) {
  return prisma.importPurchaseOrder.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      financePurchaseRef,
    },
    include: { lines: true },
  });
}
