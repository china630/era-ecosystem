import { Prisma } from "@prisma/client";
import { z } from "zod";
import { findPickListByIdWithOrderAndLines, findPickListLine, markPickListPicked, updatePickListLineQty } from "@/lib/pick-list.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type PickListWithLines = Prisma.PickListGetPayload<{ include: { order: true; lines: true } }>;

const patchSchema = z.object({
  qtyPicked: z.number().int().nonnegative(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/pick-lists/:id/lines/:lineId", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id, lineId } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const line = await findPickListLine(id, lineId);
    if (!line) return sendJson(httpRes, { error: "Pick line not found" }, 404);
    if (body.qtyPicked > line.qtyOrdered) {
      return sendJson(httpRes, { error: "qtyPicked exceeds ordered qty" }, 400);
    }

    await updatePickListLineQty(lineId, body.qtyPicked);

    const pickList = (await findPickListByIdWithOrderAndLines(
      id,
    )) as PickListWithLines | null;

    const allPicked =
      pickList?.lines.every((l) => l.qtyPicked >= l.qtyOrdered) ?? false;
    if (allPicked && pickList?.status === "OPEN") {
      await markPickListPicked(id);
    }

    const updated = await findPickListByIdWithOrderAndLines(id);

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
