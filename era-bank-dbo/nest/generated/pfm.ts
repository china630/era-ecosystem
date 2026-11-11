import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type DboAccount = {
  id: string;
  balanceMinor?: string | number | bigint;
  currency?: string;
};

const STUB_CATEGORIES = [
  { code: "FOOD", label: "Food & dining", amountMinor: "12500" },
  { code: "TRANSPORT", label: "Transport", amountMinor: "4200" },
  { code: "UTILITIES", label: "Utilities", amountMinor: "8900" },
  { code: "OTHER", label: "Other", amountMinor: "15600" },
];

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pfm", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const accounts = (await engineDboFetch(dboPaths.accounts, {
      customerJwt: auth.session.customerJwt ?? undefined,
    })) as DboAccount[];

    const list = Array.isArray(accounts) ? accounts : [];
    const totalBalanceMinor = list.reduce((sum, a) => {
      const v = a.balanceMinor ?? 0;
      return sum + BigInt(String(v));
    }, BigInt(0));

    return sendJson(httpRes, {
      totalBalanceMinor: totalBalanceMinor.toString(),
      accountCount: list.length,
      spendCategories: STUB_CATEGORIES,
      note: "PFM lab scaffold (XO-4) — spend categories are stub aggregates until engine categorization ships",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
