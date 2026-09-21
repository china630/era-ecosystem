import { prisma } from "@/lib/prisma";
import {
  isOverEntitlementQuota,
  resolveEntitlementInstance,
  resolvePackageStampForEpisode,
} from "@/domain/sanatorium/entitlement-usage.service";

export type EntitlementChargeInput = {
  episodeId?: string | null;
  patientOrigin: "WALK_IN" | "IN_HOUSE";
  quotaCode?: string | null;
  serviceCode: string;
  inPackage?: boolean;
  /**
   * When true, this fulfillment is already in the COUNT SoT (e.g. after COMPLETED sync).
   * In-quota if used <= total; over-quota only when used > total.
   * When false (create-time), free only if remaining > 0 before adding this unit.
   */
  fulfillmentCounted?: boolean;
};

export type EntitlementChargeResult = {
  amountNet: number;
  overQuota: boolean;
  priceMissing: boolean;
  reason: string;
};

/** Last-resort amount when a charge must post and the catalog has no list price. */
export const DEFAULT_OVER_QUOTA_AZN = 25;

/** Reasons where the guest owes money, so a zero amount would be a revenue leak. */
const PAID_REASONS = new Set([
  "walk_in",
  "no_package_confirmed",
  "not_in_package",
  "no_program_instance",
  "no_balance",
  "over_quota",
  "price_missing",
]);

export function isPaidChargeReason(reason: string): boolean {
  return PAID_REASONS.has(reason);
}

/**
 * Apply DEFAULT_OVER_QUOTA_AZN when the line must be paid but the catalog has no list price.
 * Keeps `priceMissing` set so the code still shows up in the admin missing-price report.
 */
export function applyPriceMissingFallback(
  charge: EntitlementChargeResult,
  context: { serviceCode: string; where: string },
): EntitlementChargeResult {
  if (!charge.priceMissing || !isPaidChargeReason(charge.reason)) return charge;
  if (charge.amountNet > 0) return charge;
  console.warn("[entitlement-charge] priceMissing fallback", {
    where: context.where,
    code: context.serviceCode,
    reason: charge.reason,
  });
  return { ...charge, amountNet: DEFAULT_OVER_QUOTA_AZN };
}

function catalogListPrice(catalog: {
  listAmount: unknown;
  amount: unknown;
} | null): number {
  if (!catalog) return 0;
  const list = catalog.listAmount != null ? Number(catalog.listAmount) : NaN;
  if (Number.isFinite(list) && list > 0) return list;
  const amount = Number(catalog.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function paidFromCatalog(
  listPrice: number,
  reasonPaid: string,
): EntitlementChargeResult {
  if (listPrice > 0) {
    return {
      amountNet: listPrice,
      overQuota: false,
      priceMissing: false,
      reason: reasonPaid,
    };
  }
  return {
    amountNet: 0,
    overQuota: false,
    priceMissing: true,
    reason: "price_missing",
  };
}

/**
 * Resolve list vs package entitlement pricing for a service line.
 * Does not invent silent fallback prices — callers may apply DEFAULT_OVER_QUOTA_AZN
 * only when a charge must post and priceMissing is true.
 */
export async function resolveEntitlementCharge(
  input: EntitlementChargeInput,
): Promise<EntitlementChargeResult> {
  const serviceCode = input.serviceCode.trim();
  const catalog = serviceCode
    ? await prisma.serviceCatalogCache.findFirst({ where: { code: serviceCode } })
    : null;
  const listPrice = catalogListPrice(catalog);

  // Walk-in is always commercial — never free from package balance.
  if (input.patientOrigin === "WALK_IN") {
    return paidFromCatalog(listPrice, "walk_in");
  }

  let episode: {
    programCode: string | null;
    noPackageConfirmedAt: Date | null;
  } | null = null;

  if (input.episodeId) {
    episode = await prisma.clinicalEpisode.findUnique({
      where: { id: input.episodeId },
      select: { programCode: true, noPackageConfirmedAt: true },
    });
  }

  if (episode?.noPackageConfirmedAt) {
    return paidFromCatalog(listPrice, "no_package_confirmed");
  }

  const instance = input.episodeId
    ? await resolveEntitlementInstance(input.episodeId)
    : null;

  // Hotel guest without package code, not confirmed, and no open instance → ops alert.
  if (
    input.episodeId &&
    episode &&
    !instance &&
    !episode.programCode?.trim() &&
    !episode.noPackageConfirmedAt
  ) {
    return {
      amountNet: 0,
      overQuota: false,
      priceMissing: false,
      reason: "awaiting_package",
    };
  }

  if (!instance) {
    return paidFromCatalog(listPrice, "no_program_instance");
  }

  let quotaCode = input.quotaCode?.trim() || null;
  let inPackage = Boolean(input.inPackage);

  if (!quotaCode && input.episodeId) {
    const stamp = await resolvePackageStampForEpisode({
      episodeId: input.episodeId,
      serviceCode,
    });
    if (stamp) {
      quotaCode = stamp.packageQuotaCode;
      inPackage = true;
    }
  }

  if (!quotaCode || !inPackage) {
    return paidFromCatalog(listPrice, "not_in_package");
  }

  const check = await isOverEntitlementQuota({
    instanceId: instance.id,
    quotaCode,
  });

  if (!check.hasBalance) {
    return paidFromCatalog(listPrice, "no_balance");
  }

  const line = await prisma.programProcedureBalance.findUnique({
    where: {
      instanceId_procedureCode: {
        instanceId: instance.id,
        procedureCode: quotaCode,
      },
    },
  });

  const inQuota = input.fulfillmentCounted
    ? !!line && line.quotaUsed <= line.quotaTotal
    : check.remaining > 0;

  if (inQuota) {
    return {
      amountNet: 0,
      overQuota: false,
      priceMissing: false,
      reason: "in_quota",
    };
  }

  // Over quota — charge list price; signal when catalog has no retail amount.
  const paid = paidFromCatalog(listPrice, "over_quota");
  return { ...paid, overQuota: true };
}
