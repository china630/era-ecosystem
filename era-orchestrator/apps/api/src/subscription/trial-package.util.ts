import type { Prisma } from "@era365/database";
import { PRICING_MODULE_CASH_BANK_PRO } from "@era365/database";

/** Default when system_config billing.trial_period_days is unset. */
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
  "platform_workforce",
  "audit_hub",
] as const;

export { computeTrialExpiresEndOfMonthBaku } from "./trial-date.util";
export { computeTrialExpiresAtBaku } from "./trial-date.util";

/**
 * End of UTC day after adding `trialDurationDays` calendar days to `signupAt`.
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
 * Org-only trial row at registration — no satellite/module materialization.
 * Owner connects verticals via POST /v1/subscription/connect-satellite.
 * `trialPeriodDays` is snapshotted into expiresAt; changing the global default
 * does not affect existing subscriptions.
 */
export async function resolveNewOrganizationTrialSubscription(
  tx: Prisma.TransactionClient,
  signupAt: Date,
  trialPeriodDays: number = DEFAULT_TRIAL_DURATION_DAYS,
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

  const days =
    Number.isFinite(trialPeriodDays) && trialPeriodDays > 0
      ? Math.floor(trialPeriodDays)
      : DEFAULT_TRIAL_DURATION_DAYS;
  const expiresAt = computeTrialExpiresAtUtc(signupAt, days);
  const trialPackageId = bundle?.id ?? "default";
  const trialPlanSlug =
    bundle?.slug === TRIAL_3_MONTHS_SLUG ? TRIAL_3_MONTHS_SLUG : bundle?.slug ?? undefined;

  const customConfig: Prisma.InputJsonValue = {
    modules: [],
    trialPackageId,
    trialPeriodDays: days,
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
