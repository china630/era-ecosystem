import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "@era/satellite-kit";
import { bootstrapKafeOwner } from "@/lib/kafe-org-bootstrap";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/kafe/bootstrap-owner", async (httpReq, httpRes) => {
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

  const authz = assertEnvServiceToken({
    expectedEnvKeys: [
      "SATELLITE_EVENT_SERVICE_TOKEN",
      "CONTROL_PLANE_SERVICE_TOKEN",
    ],
    authorization: request.headers.get("authorization"),
    xServiceToken: request.headers.get("x-service-token"),
    allowOpenInNonProduction: false,
  });
  if (!authz.ok) {
    return sendJson(httpRes, { error: authz.error }, ( { status: authz.status }).status ?? 200);
  }

  let body: {
    organizationId?: unknown;
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    cafeName?: unknown;
    activeModules?: unknown;
  };
  try {
    body = (httpReq.body) as typeof body;
  } catch {
    return sendJson(httpRes, { error: "Invalid JSON" }, 400);
  }

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName : "";
  const cafeName = typeof body.cafeName === "string" ? body.cafeName : "";
  const activeModules = Array.isArray(body.activeModules)
    ? body.activeModules.filter((k): k is string => typeof k === "string")
    : [];

  try {
    const result = await bootstrapKafeOwner({
      organizationId,
      email,
      password,
      fullName,
      cafeName,
      activeModules,
    });
    return sendJson(httpRes, { ok: true, login: result.login });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return sendJson(httpRes, { error: message }, 400);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
