import { listOpsActionLogs } from "@/lib/bank-ops.service";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { denyUnlessPermission } from "@/lib/auth/require";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/audit", async (httpReq, httpRes) => {
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

    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.AUDIT_READ,
    );
    if (denied) return denied;

    const rows = await listOpsActionLogs();

    return sendJson(httpRes, 
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        refType: r.refType,
        refId: r.refId,
        metadataJson: r.metadataJson,
        at: r.at.toISOString(),
        opsUser: r.opsUser.username,
        fullName: r.opsUser.fullName,
      })));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
