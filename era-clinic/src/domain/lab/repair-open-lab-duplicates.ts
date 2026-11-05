import { prisma } from "@/lib/prisma";

const OPEN = ["ORDERED", "COLLECTED", "IN_PROGRESS", "RESULT_READY"] as const;

function loose(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Link unattached open rows to a catalog service when the code matches,
 * then cancel extra open orders for the same patient and code.
 * Keeps the order that already had a catalog link. Does not touch closed orders.
 */
export async function repairOpenLabDuplicates(): Promise<{ linked: number; cancelled: string[] }> {
  const services = await prisma.diagnosticService.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      serviceCode: true,
      modality: { select: { kind: true } },
    },
  });
  const byLoose = new Map<string, string>();
  for (const service of services) {
    for (const code of [service.code, service.serviceCode]) {
      if (code) byLoose.set(loose(code), service.id);
    }
  }

  const orders = await prisma.labOrder.findMany({
    where: { status: { in: [...OPEN] } },
    include: { items: { include: { results: { select: { id: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  let linked = 0;
  const hadLink = new Map<string, boolean>();
  for (const order of orders) {
    hadLink.set(order.id, order.items.some((item) => item.diagnosticServiceId));
    for (const item of order.items) {
      if (item.diagnosticServiceId) continue;
      const serviceId = byLoose.get(loose(item.serviceCode)) ?? byLoose.get(loose(order.testCode));
      if (!serviceId) continue;
      await prisma.labOrderItem.update({
        where: { id: item.id },
        data: { diagnosticServiceId: serviceId },
      });
      item.diagnosticServiceId = serviceId;
      linked += 1;
    }
  }

  const groups = new Map<string, typeof orders>();
  for (const order of orders) {
    const codes = order.items.length
      ? order.items.map((item) => loose(item.serviceCode))
      : [loose(order.testCode)];
    for (const code of codes.filter(Boolean)) {
      const key = `${order.patientRefId}:${code}`;
      const list = groups.get(key) ?? [];
      list.push(order);
      groups.set(key, list);
    }
  }

  const cancelled: string[] = [];
  const already = new Set<string>();
  for (const list of groups.values()) {
    const unique = [...new Map(list.map((order) => [order.id, order])).values()];
    if (unique.length < 2) continue;
    const keeper =
      unique.find((order) => hadLink.get(order.id)) ??
      unique.find((order) => order.items.some((item) => item.results.length > 0)) ??
      unique[0]!;
    for (const order of unique) {
      if (order.id === keeper.id || already.has(order.id)) continue;
      await prisma.labOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "duplicate_open" },
      });
      cancelled.push(order.id);
      already.add(order.id);
    }
  }

  return { linked, cancelled };
}
