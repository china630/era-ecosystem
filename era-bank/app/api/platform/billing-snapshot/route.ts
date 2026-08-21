import {
  fetchSubscriptionSnapshot,
  resolveSatelliteOrganizationId,
} from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";

/**
 * Soft billing snapshot for HeaderTierUsageBar.
 * Falls back to a demo tier when control-plane is unreachable (local docker).
 */
export async function GET() {
  const { organizationId, source } = resolveSatelliteOrganizationId({
    allowFallback: true,
  });

  if (source === "fallback" || !organizationId) {
    return jsonOk({
      tier: "mvp",
      quotas: {
        activeBranches: { current: 1, max: null },
        employees: { current: 0, max: null },
      },
    });
  }

  try {
    const snapshot = await fetchSubscriptionSnapshot(organizationId);
    if (!snapshot) {
      return jsonOk({
        tier: "mvp",
        quotas: {
          activeBranches: { current: 1, max: null },
          employees: { current: 0, max: null },
        },
      });
    }
    const tier =
      (snapshot as { tier?: string; plan?: string }).tier ??
      (snapshot as { plan?: string }).plan ??
      "mvp";
    const quotas = (snapshot as {
      quotas?: BillingQuotas;
    }).quotas;
    return jsonOk({
      tier,
      quotas: {
        activeBranches: quotas?.activeBranches ?? quotas?.active_branches ?? {
          current: 1,
          max: null,
        },
        employees: quotas?.employees ?? { current: 0, max: null },
      },
    });
  } catch {
    return jsonOk({
      tier: "mvp",
      quotas: {
        activeBranches: { current: 1, max: null },
        employees: { current: 0, max: null },
      },
    });
  }
}

type QuotaCell = { current?: number; max?: number | null };
type BillingQuotas = {
  activeBranches?: QuotaCell;
  active_branches?: QuotaCell;
  employees?: QuotaCell;
};
