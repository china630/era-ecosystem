import { computePrismaMigrationHash } from "@era/satellite-kit/placement";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-utils";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function assertServiceToken(request: Request): boolean {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const auth = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

/**
 * Placement preflight — migration hash (+ optional free-disk hint from env).
 * Orch compares source pool vs dedicated clone before EXPORT/IMPORT.
 */
export async function GET(request: Request) {
  try {
    if (!assertServiceToken(request)) return unauthorized();
    const mig = await computePrismaMigrationHash(prisma);
    const freeHint = process.env.ERA_PLACEMENT_DISK_FREE_BYTES?.trim();
    const freeBytes = freeHint ? Number(freeHint) : null;
    return jsonOk({
      ok: true,
      migrationHash: mig.hash,
      migrationCount: mig.migrationCount,
      freeBytes:
        freeBytes != null && Number.isFinite(freeBytes) ? freeBytes : null,
      loginPath: "/login",
      healthPath: "/api/health",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/internal/v1/placement/preflight", async (httpReq, httpRes) => {
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

  
    if (!assertServiceToken(request)) return unauthorized();
    const mig = await computePrismaMigrationHash(prisma);
    const freeHint = process.env.ERA_PLACEMENT_DISK_FREE_BYTES?.trim();
    const freeBytes = freeHint ? Number(freeHint) : null;
    return sendJson(httpRes, {
      ok: true,
      migrationHash: mig.hash,
      migrationCount: mig.migrationCount,
      freeBytes:
        freeBytes != null && Number.isFinite(freeBytes) ? freeBytes : null,
      loginPath: "/login",
      healthPath: "/api/health",
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/internal/v1/placement/preflight", async (httpReq, httpRes) => {
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

  return GET(request);

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
