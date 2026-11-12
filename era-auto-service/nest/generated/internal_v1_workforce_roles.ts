import { NextResponse } from "next/server";
import { enterRequestTenant } from "@/lib/request-organization";
import { listWorkforceRoleCodes } from "@/lib/workforce-role.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function bridgeSecret(): string {
  return process.env.SATELLITE_BRIDGE_SECRET?.trim() || "";
}

/** Control plane reads role codes. Permissions stay on this satellite. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/workforce/roles", async (httpReq, httpRes) => {
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

  const secret = bridgeSecret();
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret || header !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }
  const organizationId =
    new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
  if (!organizationId) {
    return sendJson(httpRes, { error: "organizationId required" }, 400);
  }
  enterRequestTenant(organizationId);
  const roles = await listWorkforceRoleCodes(organizationId);
  return sendJson(httpRes, {
    roles: roles.map((role) => ({
      code: role.code,
      name: role.name,
      active: true,
    })),
  });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
