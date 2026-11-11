import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePosTable, findPosHallInOutlet, findPosTableById, updatePosTable } from "@/lib/hall.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  seats: z.number().int().positive().optional(),
  zone: z.string().nullable().optional(),
  hallId: z.string().nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/tables/:id", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await findPosTableById(id);
    if (!existing) return sendJson(httpRes, { error: "Table not found" }, 404);
    if (body.hallId) {
      const hall = await findPosHallInOutlet(body.hallId, existing.outletId);
      if (!hall) return sendJson(httpRes, { error: "Hall not found" }, 404);
    }

    if (existing.status === "OCCUPIED" && (body.code || body.name)) {
      // Allow metadata edits while occupied; block delete only.
    }

    const table = await updatePosTable(id, {
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.seats !== undefined ? { seats: body.seats } : {}),
      ...(body.zone !== undefined ? { zone: body.zone } : {}),
      ...(body.hallId !== undefined ? { hallId: body.hallId } : {}),
    });
    return sendJson(httpRes, table);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/tables/:id", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const existing = await findPosTableById(id);
    if (!existing) return sendJson(httpRes, { error: "Table not found" }, 404);
    if (existing.status === "OCCUPIED" || existing.currentTicketId) {
      return sendJson(httpRes, 
        { error: "Cannot delete occupied table", code: "TABLE_OCCUPIED" }, 400);
    }

    await deletePosTable(id);
    return sendJson(httpRes, { ok: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
