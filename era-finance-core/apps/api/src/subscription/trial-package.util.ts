import type { Prisma } from "@erafinance/database";
import { PRICING_MODULE_CASH_BANK_PRO } from "@erafinance/database";
import { computeTrialExpiresEndOfMonthBaku } from "@era/satellite-kit/time";

export {
  computeTrialExpiresAtBaku,
  computeTrialExpiresEndOfMonthBaku,
} from "@era/satellite-kit/time";

/** @deprecated Always use {@link computeTrialExpiresAtBaku} with 3 calendar months. */
export const DEFAULT_TRIAL_DURATION_DAYS = 90;

export const TRIAL_3_MONTHS_SLUG = "TRIAL_3_MONTHS";

/**
 * Slugs granted on trial when no `PricingBundle` with trial slug/default exists.
 * Excludes paid government / AI add-ons.
 */
export const DEFAULT_TRIAL_MODULE_SLUGS: readonly string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
  "production",
  "manufacturing",
  "fixed_assets",
  PRICING_MODULE_CASH_BANK_PRO,
  "inventory",
  "hr_full",
  "audit_hub",
] as const;

/**
 * End of UTC day after adding `trialDurationDays` calendar days to `signupAt`.
 * @deprecated Prefer {@link computeTrialExpiresAtBaku} for new org trials.
 */
export function computeTrialExpiresAtUtc(
  signupAt: Date,
  trialDurationDays: number,
): Date {
  const d = new Date(signupAt);
  const n = Math.max(1, Math.floor(trialDurationDays));
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type TrialSubscriptionSeed = {
  expiresAt: Date;
  activeModules: string[];
  customConfig: Prisma.InputJsonValue;
};

/**
 * Resolves initial trial subscription payload for a new organization (inside a transaction).
 */
export async function resolveNewOrganizationTrialSubscription(
  tx: Prisma.TransactionClient,
  signupAt: Date,
): Promise<TrialSubscriptionSeed> {
  let bundle = await tx.pricingBundle.findFirst({
    where: { slug: TRIAL_3_MONTHS_SLUG },
  });
  if (!bundle) {
    bundle = await tx.pricingBundle.findFirst({
      where: { isTrialDefault: true },
      orderBy: { createdAt: "asc" },
    });
  }

  const expiresAt = computeTrialExpiresEndOfMonthBaku(signupAt, 3);

  const trialPackageId = bundle?.id ?? "default";
  const trialPlanSlug =
    bundle?.slug === TRIAL_3_MONTHS_SLUG ? TRIAL_3_MONTHS_SLUG : bundle?.slug ?? undefined;

  const customConfig: Prisma.InputJsonValue = {
    modules: [],
    trialPackageId,
    ...(trialPlanSlug ? { trialPlanSlug } : {}),
    ...(bundle?.trialQuotas != null &&
    typeof bundle.trialQuotas === "object" &&
    bundle.trialQuotas !== null
      ? { trialQuotas: bundle.trialQuotas as Prisma.InputJsonValue }
      : {}),
  };

  return {
    expiresAt,
    activeModules: [],
    customConfig,
  };
}
