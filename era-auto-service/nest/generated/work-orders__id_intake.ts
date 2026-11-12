import { z } from "zod";
import { findWorkOrderById, updateWorkOrderIntake } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  vin: z.string().max(32).optional(),
  intakeNotes: z.string().optional(),
  intakePhotoUrls: z.array(z.string().max(2048)).optional(),
  checklist: z.record(z.boolean()).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/work-orders/:id/intake", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const wo = await findWorkOrderById(id);
    if (!wo) return sendJson(httpRes, { error: "Work order not found" }, 404);

    const intakePhotoUrls = body.checklist
      ? JSON.stringify({ photos: body.intakePhotoUrls ?? [], checklist: body.checklist })
      : body.intakePhotoUrls
        ? JSON.stringify({ photos: body.intakePhotoUrls })
        : undefined;

    const updated = await updateWorkOrderIntake(id, {
      vin: body.vin,
      intakeNotes: body.intakeNotes,
      intakePhotoUrls,
      existingVin: wo.vin,
      existingIntakePhotoUrls: wo.intakePhotoUrls,
    });
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
