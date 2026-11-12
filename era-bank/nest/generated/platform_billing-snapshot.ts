import { fetchSubscriptionSnapshot } from "@era/satellite-kit";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Soft billing snapshot for HeaderTierUsageBar.
 * Falls back to a demo tier when control-plane is unreachable (local docker).
 */


type QuotaCell = { current?: number; max?: number | null };
type BillingQuotas = {
  activeBranches?: QuotaCell;
  active_branches?: QuotaCell;
  employees?: QuotaCell;
};

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/platform/billing-snapshot", async (httpReq, httpRes) => {
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const { organizationId } = session;
    if (!organizationId) {
      return sendJson(httpRes, {
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
        return sendJson(httpRes, {
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
      return sendJson(httpRes, {
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
      return sendJson(httpRes, {
        tier: "mvp",
        quotas: {
          activeBranches: { current: 1, max: null },
          employees: { current: 0, max: null },
        },
      });
    }
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
