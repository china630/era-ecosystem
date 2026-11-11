import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  eraPathnameRequestHeaders,
  redirectReferralToOrchestratorRegister,
} from "@era/satellite-kit/auth/middleware-edge";

export function middleware(request: NextRequest) {
  const referralRedirect = redirectReferralToOrchestratorRegister(request);
  if (referralRedirect) return referralRedirect;
  const path = request.nextUrl.pathname;
  const mdmProxy =
    path === "/api/cp-mdm" ||
    path.startsWith("/api/cp-mdm/") ||
    path === "/api/platform/mdm/workforce" ||
    path.startsWith("/api/platform/mdm/workforce/");
  if (mdmProxy) {
    const callerAuth = request.headers.get("authorization")?.trim() ?? "";
    if (!callerAuth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const serviceToken =
      process.env.MDM_INTERNAL_SERVICE_TOKEN ??
      process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ??
      process.env.CONTROL_PLANE_SERVICE_TOKEN ??
      process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
      "";
    if (!serviceToken && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "MDM service token not configured" }, { status: 503 });
    }
    const api = (
      process.env.ORCH_API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_ORCH_API_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    const destPath = path.startsWith("/api/platform/mdm/workforce")
      ? path.replace("/api/platform/mdm/workforce", "/internal/v1/mdm/persons")
      : path.replace("/api/cp-mdm", "/internal/v1/mdm");
    const dest = new URL(`${api}${destPath}`);
    request.nextUrl.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
    const orgId = request.headers.get("x-organization-id")?.trim();
    if (orgId && !dest.searchParams.has("organizationId")) {
      dest.searchParams.set("organizationId", orgId);
    }
    const headers = eraPathnameRequestHeaders(request.headers, path);
    headers.set("authorization", callerAuth);
    if (serviceToken) headers.set("x-service-token", serviceToken);
    if (orgId) headers.set("x-organization-id", orgId);
    return NextResponse.rewrite(dest, { request: { headers } });
  }
  const reqHeaders = eraPathnameRequestHeaders(
    request.headers,
    request.nextUrl.pathname,
  );
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
