import { prisma } from "@/lib/prisma";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  resolveEntitlementInstance,
  syncEntitlementUsage,
} from "@/domain/sanatorium/entitlement-usage.service";
import {
  applyPriceMissingFallback,
  DEFAULT_OVER_QUOTA_AZN,
  resolveEntitlementCharge,
} from "@/domain/sanatorium/entitlement-charge.service";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import { isSameDayFourthOrLater } from "@/lib/sanatorium-day1";

export type ProcedureChargeContext = {
  overQuota: boolean;
  amountNet: number;
  shouldChargeFolio: boolean;
  /** True when no list price is available (W3 surfaces this; legacy path may fall back). */
  priceMissing?: boolean;
  /** Entitlement reason from resolveEntitlementCharge — `awaiting_package` must stay visible. */
  reason?: string;
};

/**
 * Resolve quota burn + list/package pricing for a procedure order.
 * Shared by COMPLETED and NO_SHOW (client-fault still burns quota / may charge).
 * Pass `{ burnQuota: false }` for Issue-ticket / nurse gate so listing a ticket does not consume quota.
 *
 * Quota SoT is COUNT via syncEntitlementUsage — never increment. Key is packageQuotaCode
 * (pool/alias) falling back to procedureCode.
 * Pricing SoT is resolveEntitlementCharge (listAmount preferred).
 */
export async function resolveProcedureCharge(
  order: {
    id: string;
    procedureCode: string;
    procedureName: string;
    reservationId: string | null;
    patientOrigin: string;
    amountNet: unknown;
  },
  opts?: { burnQuota?: boolean },
): Promise<ProcedureChargeContext> {
  const burnQuota = opts?.burnQuota !== false;
  let overQuota = false;
  const orderFull = await prisma.procedureOrder.findUnique({
    where: { id: order.id },
    select: {
      patientRefId: true,
      clinicalEpisodeId: true,
      inPackage: true,
      packageQuotaCode: true,
      procedureCode: true,
    },
  });
  const quotaCode =
    orderFull?.packageQuotaCode?.trim() ||
    orderFull?.procedureCode ||
    order.procedureCode;

  // Instance must come from this order's own episode — a patient may have a second
  // (re-opened) episode whose instance would otherwise receive the sync.
  const episodeId = orderFull?.clinicalEpisodeId ?? null;
  const program = episodeId
    ? await resolveEntitlementInstance(episodeId)
    : order.reservationId
      ? await prisma.programInstance.findFirst({
          where: { reservationId: order.reservationId },
        })
      : null;

  if (program && episodeId) {
    if (burnQuota) {
      // Sync COUNT while this order already sits in a counted status (caller updates first).
      await syncEntitlementUsage({
        instanceId: program.id,
        episodeId,
        quotaCode,
      });
    }
    const line = await prisma.programProcedureBalance.findUnique({
      where: {
        instanceId_procedureCode: {
          instanceId: program.id,
          procedureCode: quotaCode,
        },
      },
    });
    if (line) {
      // In-package orders are inside the COUNT, so the Nth of N is still in quota.
      overQuota = orderFull?.inPackage
        ? line.quotaUsed > line.quotaTotal
        : line.quotaUsed >= line.quotaTotal;
    }
  }

  const origin =
    order.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";

  let charge = await resolveEntitlementCharge({
    episodeId,
    patientOrigin: origin,
    quotaCode,
    serviceCode: order.procedureCode,
    inPackage: orderFull?.inPackage,
    fulfillmentCounted: burnQuota && !!episodeId,
  });

  if (overQuota && charge.reason === "in_quota") {
    // Balance row says exhausted while pricing saw quota left — bill at list price.
    charge = await resolveEntitlementCharge({
      episodeId,
      patientOrigin: origin,
      quotaCode,
      serviceCode: order.procedureCode,
      inPackage: false,
    });
  }
  if (overQuota) charge = { ...charge, overQuota: true };

  charge = applyPriceMissingFallback(charge, {
    serviceCode: order.procedureCode,
    where: "procedure",
  });

  let amountNet = charge.amountNet;
  let priceMissing = charge.priceMissing;

  // Prefer existing positive amount when entitlement says paid but order already priced.
  if (amountNet <= 0 && !priceMissing && Number(order.amountNet) > 0 && charge.reason !== "in_quota") {
    amountNet = Number(order.amountNet);
  }

  // Wave C: PDF >3 same calendar day → 4th+ paid; strip package stamp (do not decrement quotaUsed).
  if (charge.reason === "in_quota" && amountNet === 0 && order.patientOrigin === "IN_HOUSE") {
    const { bakuDayBounds, todayBakuYmd } = await import("@/domain/ops/day-summary.service");
    const { start, end } = bakuDayBounds(todayBakuYmd());
    const sameDayCount = await prisma.procedureOrder.count({
      where: {
        patientRefId: orderFull?.patientRefId,
        status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] },
        scheduledAt: { gte: start, lt: end },
        id: { not: order.id },
      },
    });
    if (isSameDayFourthOrLater(sameDayCount)) {
      const dayCharge = applyPriceMissingFallback(
        await resolveEntitlementCharge({
          episodeId,
          patientOrigin: "WALK_IN",
          serviceCode: order.procedureCode,
          inPackage: false,
        }),
        { serviceCode: order.procedureCode, where: "procedure-4th-same-day" },
      );
      amountNet = dayCharge.amountNet;
      priceMissing = dayCharge.priceMissing;
      if (burnQuota) {
        await prisma.procedureOrder.update({
          where: { id: order.id },
          data: { inPackage: false, packageQuotaCode: null },
        });
        if (program && episodeId) {
          await syncEntitlementUsage({
            instanceId: program.id,
            episodeId,
            quotaCode,
          });
        }
      }
    }
  }

  const settings = await getSchedulingSettings();
  const billingTarget = await resolveBillingTarget(order.patientOrigin as "WALK_IN" | "IN_HOUSE");
  const shouldChargeFolio =
    billingTarget === "HOTEL_FOLIO" &&
    !!order.reservationId &&
    amountNet > 0 &&
    (!overQuota || settings.procedureOverQuotaPolicy === "CHARGE_FOLIO");

  return { overQuota, amountNet, shouldChargeFolio, priceMissing, reason: charge.reason };
}

export async function postProcedureFolioCharge(input: {
  reservationId: string;
  amount: number;
  description: string;
  externalTicketId: string;
}): Promise<void> {
  await postHotelRoomCharge({
    reservationId: input.reservationId,
    amount: input.amount,
    description: input.description,
    externalTicketId: input.externalTicketId,
  });
}

/** Persist charge visibility for cashier (folio / local / blocked / warn). */
export async function logProcedureCharge(input: {
  procedureOrderId: string;
  patientRefId: string;
  reservationId?: string | null;
  procedureCode: string;
  procedureName: string;
  amountNet: number;
  overQuota: boolean;
  channel: "HOTEL_FOLIO" | "LOCAL" | "BLOCKED" | "WARN_ONLY";
  externalTicketId?: string | null;
  /**
   * Log even at 0 AZN — used for `awaiting_package`, where work is done but the
   * package has not arrived yet, so the cashier needs a backlog row to bill later.
   */
  forceLog?: boolean;
}): Promise<void> {
  if (input.amountNet <= 0 && !input.overQuota && !input.forceLog) return;
  await prisma.procedureChargeLog.create({
    data: {
      procedureOrderId: input.procedureOrderId,
      patientRefId: input.patientRefId,
      reservationId: input.reservationId ?? null,
      procedureCode: input.procedureCode,
      procedureName: input.procedureName,
      amountNet: input.amountNet,
      overQuota: input.overQuota,
      channel: input.channel,
      externalTicketId: input.externalTicketId ?? null,
    },
  });
}

export { DEFAULT_OVER_QUOTA_AZN };

/** Charge reason meaning: service delivered, package not yet known — bill later. */
export const AWAITING_PACKAGE_REASON = "awaiting_package";
