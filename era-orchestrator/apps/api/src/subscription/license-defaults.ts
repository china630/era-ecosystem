import { computeTrialExpiresAtUtc } from "./trial-package.util";

export const DEPLOYMENT_TOPOLOGIES = ["SHARED", "DEDICATED", "ONPREM"] as const;
export type DeploymentTopologyCode = (typeof DEPLOYMENT_TOPOLOGIES)[number];

export function isDeploymentTopology(value: string): value is DeploymentTopologyCode {
  return (DEPLOYMENT_TOPOLOGIES as readonly string[]).includes(value);
}

export type LicenseProvisionPlan = {
  isTrial: boolean;
  expiresAt: Date | null;
};

/**
 * First-provision license clock from placement.
 * Super-admin may override later (shrink, extend, perpetual = null).
 */
export function licenseProvisionPlan(
  topology: DeploymentTopologyCode,
  signupAt: Date,
  trialPeriodDays: number,
): LicenseProvisionPlan {
  if (topology === "SHARED") {
    return {
      isTrial: true,
      expiresAt: computeTrialExpiresAtUtc(signupAt, trialPeriodDays),
    };
  }
  return { isTrial: false, expiresAt: null };
}

export function shiftLicenseDate(current: Date | null, shiftMonths: number, now = new Date()): Date {
  const n = Math.trunc(shiftMonths);
  const base =
    current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()
      ? new Date(current)
      : new Date(now);
  base.setUTCMonth(base.getUTCMonth() + n);
  return base;
}
