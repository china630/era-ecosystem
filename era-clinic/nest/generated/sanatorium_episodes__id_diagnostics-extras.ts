import { z } from "zod";
import { jsonError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { deletePendingDiagnostic, listPendingDiagnostics, payDiagnosticsExtras, prescribeDiagnosticsExtras } from "@/domain/sanatorium/diagnostics-extras.service";
import { listExtraUnitPrices } from "@/domain/sanatorium/extras-assign.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const prescribeSchema = z.object({
  lines: z
    .array(
      z.object({
        serviceCode: z.string().min(1),
        qty: z.number().int().positive().max(40),
        note: z.string().max(2000).optional().nullable(),
        scheduledAt: z.string().max(32).optional().nullable(),
      }),
    )
    .min(1),
});

const paySchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["lab", "visit"]),
      }),
    )
    .min(1),
});

function mapError(err: unknown) {
  if (err instanceof PackageAssignError) {
    return jsonError(err.message, err.status, { code: err.code });
  }
  return null;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes/:id/diagnostics-extras", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const [items, prices] = await Promise.all([
      listPendingDiagnostics(id),
      listExtraUnitPrices(),
    ]);
    return sendJson(httpRes, { items, prices });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/episodes/:id/diagnostics-extras", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const raw = httpReq.body;
    if (raw?.action === "pay") {
      const body = paySchema.parse(raw);
      const result = await payDiagnosticsExtras(body.lines, session.sub);
      return sendJson(httpRes, result);
    }
    const body = prescribeSchema.parse(raw);
    const result = await prescribeDiagnosticsExtras(id, body.lines, session.sub);
    return sendJson(httpRes, result);
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/sanatorium/episodes/:id/diagnostics-extras", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  try {
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const url = new URL(req.url);
    const rowId = url.searchParams.get("id");
    const kind = url.searchParams.get("kind");
    if (!rowId || (kind !== "lab" && kind !== "visit")) {
      return sendJson(httpRes, { error: "id and kind=lab|visit required" }, 400);
    }
    await deletePendingDiagnostic(kind, rowId);
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
