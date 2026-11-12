import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { regimeFromOrderSites } from "@/domain/sanatorium/regime-key";
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";
import { readUiLocale } from "@/lib/request-locale";
import { deletePendingExtra, dropPendingExtrasFromTail, listExtraUnitPrices, listPaidExtras, listPendingExtras, placeHeldExtrasOnCheckoutMorning, prescribeExtras, releaseHeldExtras } from "@/domain/sanatorium/extras-assign.service";
import { deletePendingDiagnostic, listPendingDiagnostics } from "@/domain/sanatorium/diagnostics-extras.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  procedureCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  note: z.string().max(2000).optional().nullable(),
  bodyPart: z.string().max(64).optional().nullable(),
  physioFields: z.record(z.unknown()).optional().nullable(),
  siteIds: z.array(z.string()).optional(),
  siteApplyMode: z.enum(["TURN", "TOGETHER"]).optional().nullable(),
  siteLaterality: z
    .record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable())
    .optional(),
  preferredPractitionerId: z.string().min(1).nullable().optional(),
});

const prescribeSchema = z.object({
  lines: z.array(lineSchema).max(40).default([]),
  checkoutMorning: z.boolean().optional(),
  releaseHeld: z.boolean().optional(),
  removals: z
    .array(
      z.object({
        procedureCode: z.string().min(1),
        qty: z.number().int().positive().max(40),
        kind: z.enum(["procedure", "lab", "visit"]).optional(),
        orderIds: z.array(z.string().min(1)).max(40).optional(),
      }),
    )
    .max(40)
    .optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes/:id/extras-prescribe", async (httpReq, httpRes) => {
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
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const [rows, paid, diagnostics] = await Promise.all([
      listPendingExtras(id),
      listPaidExtras(id),
      listPendingDiagnostics(id),
    ]);
    const prices = await listExtraUnitPrices();
    const locale = await readUiLocale(req);
    const catalogNames = await loadCatalogDisplayNameMap(
      [...rows, ...paid].map((row) => row.procedureCode),
      locale,
    );
    return sendJson(httpRes, {
      items: [
        ...rows.map((r) => ({
          id: r.id,
          kind: "procedure" as const,
          procedureCode: r.procedureCode,
          procedureName: catalogNames.get(r.procedureCode) || r.procedureName,
          amountNet: Number(r.amountNet),
          note: r.note,
          status: r.status,
          scheduledAt: r.scheduledAt.toISOString(),
          regimeKey: regimeFromOrderSites(r),
          physioFields: r.physioFields,
          siteIds: r.sites.map((site) => site.siteId),
          siteApplyMode: r.siteApplyMode,
          siteLaterality: Object.fromEntries(
            r.sites.map((site) => [site.siteId, site.laterality]),
          ),
        })),
        ...diagnostics.map((r) => ({
          id: r.id,
          kind: r.kind,
          procedureCode: r.serviceCode,
          procedureName: r.title,
          amountNet: r.amountNet,
          note: null as string | null,
          status: r.status,
        })),
      ],
      prices,
      paid: paid.map((r) => ({
        id: r.id,
        kind: "procedure" as const,
        procedureCode: r.procedureCode,
        procedureName: catalogNames.get(r.procedureCode) || r.procedureName,
        amountNet: Number(r.amountNet),
        regimeKey: regimeFromOrderSites(r),
      })),
      diagnostics,
    });
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, err.status);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/episodes/:id/extras-prescribe", async (httpReq, httpRes) => {
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
    const body = prescribeSchema.parse(httpReq.body);
    const removals = body.removals ?? [];
    if (body.releaseHeld && body.lines.length === 0) {
      const released = await releaseHeldExtras(id);
      return sendJson(httpRes, { released });
    }
    if (body.checkoutMorning && body.lines.length === 0) {
      const seated = await placeHeldExtrasOnCheckoutMorning(id, session.sub);
      return sendJson(httpRes, seated);
    }
    if (body.lines.length === 0 && removals.length === 0) {
      return sendJson(httpRes, { error: "Nothing to save" }, 400);
    }
    const touched = new Set<string>();
    for (const removal of removals) {
      touched.add(removal.procedureCode);
      if (removal.kind === "lab" || removal.kind === "visit") {
        const { listPendingDiagnostics, deletePendingDiagnostic } = await import(
          "@/domain/sanatorium/diagnostics-extras.service"
        );
        const pending = await listPendingDiagnostics(id);
        const matches = pending.filter(
          (row) => row.kind === removal.kind && row.serviceCode === removal.procedureCode,
        );
        const drop = matches.slice(-removal.qty);
        for (const row of drop) await deletePendingDiagnostic(removal.kind, row.id);
        continue;
      }
      if (removal.orderIds && removal.orderIds.length > 0) {
        for (const orderId of removal.orderIds) {
          try {
            await deletePendingExtra(orderId);
          } catch (err) {
            if (err instanceof PackageAssignError && err.code === "NOT_FOUND") continue;
            throw err;
          }
        }
      } else {
        await dropPendingExtrasFromTail(id, removal.procedureCode, removal.qty);
      }
    }
    const result =
      body.lines.length > 0
        ? await prescribeExtras(id, body.lines, session.sub)
        : { orderIds: [], labOrderIds: [], visitIds: [], misses: [] };
    for (const line of body.lines) touched.add(line.procedureCode);
    const { compactOpenRegimeQueues } = await import("@/domain/procedure/open-attendance");
    const repackMisses = await compactOpenRegimeQueues(id, [...touched], {
      appendIds: result.orderIds,
    });
    return sendJson(httpRes, { ...result, misses: [...result.misses, ...repackMisses] });
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, err.status);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/sanatorium/episodes/:id/extras-prescribe", async (httpReq, httpRes) => {
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
    const orderId = url.searchParams.get("orderId");
    if (!orderId) return sendJson(httpRes, { error: "orderId required" }, 400);
    const kind = url.searchParams.get("kind");
    if (kind === "lab" || kind === "visit") {
      await deletePendingDiagnostic(kind, orderId);
      return sendJson(httpRes, { ok: true });
    }
    try {
      await deletePendingExtra(orderId);
    } catch (err) {
      if (err instanceof PackageAssignError && err.code === "NOT_FOUND") {
        try {
          await deletePendingDiagnostic("lab", orderId);
          return sendJson(httpRes, { ok: true });
        } catch {
          await deletePendingDiagnostic("visit", orderId);
          return sendJson(httpRes, { ok: true });
        }
      }
      throw err;
    }
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, err.status);
    }
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
