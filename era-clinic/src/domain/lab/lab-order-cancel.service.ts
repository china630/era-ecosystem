import { prisma } from "@/lib/prisma";

export const LAB_NOT_ORDERED = "LAB_NOT_ORDERED";

async function syncLabOrderEntitlements(order: {
  clinicalEpisodeId: string | null;
  items?: Array<{ packageQuotaCode: string | null; serviceCode: string; inPackage: boolean }>;
}) {
  if (!order.clinicalEpisodeId) return;
  const { resolveEntitlementInstance, syncEntitlementUsage } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  const instance = await resolveEntitlementInstance(order.clinicalEpisodeId);
  if (!instance) return;
  const codes = new Set<string>();
  for (const item of order.items ?? []) {
    if (!item.inPackage) continue;
    codes.add(item.packageQuotaCode?.trim() || item.serviceCode);
  }
  for (const quotaCode of codes) {
    if (!quotaCode) continue;
    await syncEntitlementUsage({
      instanceId: instance.id,
      episodeId: order.clinicalEpisodeId,
      quotaCode,
    });
  }
}

export async function cancelLabOrder(
  id: string,
  input: { userId: string; reason?: string | null },
) {
  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    const err = new Error("Lab order not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  if (order.status !== "ORDERED") {
    const err = new Error("Only ORDERED lab orders can be cancelled");
    (err as Error & { code?: string }).code = LAB_NOT_ORDERED;
    throw err;
  }

  const updated = await prisma.labOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: input.userId,
      cancelReason: input.reason?.trim() || null,
    },
    include: {
      patientRef: true,
      items: {
        include: { diagnosticService: { include: { modality: true } } },
      },
    },
  });
  await syncLabOrderEntitlements(order);
  return updated;
}
