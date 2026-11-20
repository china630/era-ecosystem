import { prisma } from "@/lib/prisma";

export const LAB_NOT_ORDERED = "LAB_NOT_ORDERED";
/** Keep in sync with `BROUGHT_IN_BLANK_REASON` in brought-in-result (avoid import cycle). */
const BROUGHT_IN_BLANK_REASON = "brought_in_blank";

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

export const LAB_NOT_BROUGHT_IN_CANCEL = "LAB_NOT_BROUGHT_IN_CANCEL";

/** Reopen a lab cancelled only for a guest brought-in blank. */
export async function reopenBroughtInCancelledLabOrder(id: string) {
  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    const err = new Error("Lab order not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  if (order.status !== "CANCELLED" || order.cancelReason !== BROUGHT_IN_BLANK_REASON) {
    const err = new Error("Only brought-in blank cancellations can be reopened");
    (err as Error & { code?: string }).code = LAB_NOT_BROUGHT_IN_CANCEL;
    throw err;
  }

  const updated = await prisma.labOrder.update({
    where: { id },
    data: {
      status: "ORDERED",
      cancelledAt: null,
      cancelledByUserId: null,
      cancelReason: null,
    },
    include: {
      patientRef: true,
      items: {
        include: { diagnosticService: { include: { modality: true } } },
      },
    },
  });
  await syncLabOrderEntitlements(updated);
  return updated;
}
