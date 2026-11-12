import { requestOrganizationId } from "@/lib/request-organization";
import { createTradeCreditRequestCache, probeTradeCreditSku, readCreditFromFinance, readCreditLimitStub } from "@/lib/credit-limit";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/credit-limit", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const url = new URL(req.url);
    const counterpartyId = url.searchParams.get("counterpartyId");
    if (!counterpartyId) {
      return sendJson(httpRes, { error: "counterpartyId query param is required" }, 400);
    }

    const authHeader =
      req.headers.get("authorization") ??
      (process.env.FINANCE_API_TOKEN
        ? `Bearer ${process.env.FINANCE_API_TOKEN}`
        : null);

    let organizationId: string | null = null;
    try {
      organizationId = requestOrganizationId();
    } catch {
      organizationId = null;
    }

    const cache = createTradeCreditRequestCache();
    const probe = await probeTradeCreditSku(
      counterpartyId,
      authHeader,
      cache,
      organizationId,
    );
    if (probe.skuEnabled && probe.facility) {
      return sendJson(httpRes, {
        counterpartyId,
        creditLimit: probe.facility.creditLimit,
        available: probe.facility.available,
        stopList: probe.facility.stopList,
        currency: "AZN",
        source: probe.facility.source,
      });
    }

    const finance = await readCreditFromFinance(counterpartyId, authHeader);
    if (finance) {
      return sendJson(httpRes, {
        counterpartyId,
        creditLimit: finance.creditLimit,
        available: finance.creditLimit,
        stopList: false,
        currency: "AZN",
        source: finance.source,
      });
    }

    const creditLimit = readCreditLimitStub(counterpartyId);
    return sendJson(httpRes, {
      counterpartyId,
      creditLimit,
      available: creditLimit,
      stopList: false,
      currency: "AZN",
      source: process.env.FINANCE_API_URL ? "env_stub_fallback" : "env_stub",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
