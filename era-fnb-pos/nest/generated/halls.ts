import { z } from "zod";
import { createPosHall, findPosHallWithHighestSortOrder, listPosHallNamesForOutlet, listPosHallsForOutlet } from "@/lib/hall.service";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TABLES } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/halls", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TABLES);
    if (denied) return denied;
    const outlet = await resolveOpsOutlet();
    const halls = await listPosHallsForOutlet(outlet.id);
    return sendJson(httpRes, 
      halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        sortOrder: hall.sortOrder,
        tableCount: hall._count.tables,
      })),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/halls", async (httpReq, httpRes) => {
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
    const body = createSchema.parse(httpReq.body);
    const outlet = await resolveOpsOutlet();
    const taken = await listPosHallNamesForOutlet(outlet.id);
    const key = body.name.toLocaleLowerCase();
    if (taken.some((row) => row.name.trim().toLocaleLowerCase() === key)) {
      return sendJson(httpRes, { error: "Hall already exists", code: "HALL_DUPLICATE" }, 409);
    }
    const last = await findPosHallWithHighestSortOrder(outlet.id);
    const hall = await createPosHall({
      organizationId: requestOrganizationId(),
      outletId: outlet.id,
      name: body.name,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
    return sendJson(httpRes, hall, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
