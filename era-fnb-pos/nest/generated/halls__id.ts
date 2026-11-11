import { z } from "zod";
import { applyPosHallSortOrders, deletePosHallAndDetachTables, findPosHallById, findPosHallWithTableStatuses, listOtherPosHallNames, listPosHallsOrderedForOutlet, updatePosHall } from "@/lib/hall.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/halls/:id", async (httpReq, httpRes) => {
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
    const hall = await findPosHallById(id);
    if (!hall) return sendJson(httpRes, { error: "Hall not found" }, 404);
    if (body.direction) {
      const halls = await listPosHallsOrderedForOutlet(hall.outletId);
      const index = halls.findIndex((row) => row.id === hall.id);
      const swap = body.direction === "up" ? index - 1 : index + 1;
      if (index >= 0 && swap >= 0 && swap < halls.length) {
        const next = [...halls];
        const [moved] = next.splice(index, 1);
        next.splice(swap, 0, moved!);
        await applyPosHallSortOrders(next.map((row, order) => ({ id: row.id, sortOrder: order })));
      }
    }
    if (body.name) {
      const taken = await listOtherPosHallNames(hall.outletId, id);
      const key = body.name.toLocaleLowerCase();
      if (taken.some((row) => row.name.trim().toLocaleLowerCase() === key)) {
        return sendJson(httpRes, { error: "Hall already exists", code: "HALL_DUPLICATE" }, 409);
      }
      await updatePosHall(id, { name: body.name });
    }
    return sendJson(httpRes, await findPosHallById(id));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/halls/:id", async (httpReq, httpRes) => {
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
    const hall = await findPosHallWithTableStatuses(id);
    if (!hall) return sendJson(httpRes, { error: "Hall not found" }, 404);
    const busy = hall.tables.some((table) => table.status === "OCCUPIED" || table.currentTicketId);
    if (busy) return sendJson(httpRes, { error: "Hall has an open table" }, 409);
    await deletePosHallAndDetachTables(id);
    return sendJson(httpRes, { ok: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
