import { z } from "zod";
import { enterRequestTenant, requestOrganizationId } from "@/lib/request-organization";
import { createPrescriptionQueueRow } from "@/lib/prescription-queue.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().positive(),
  description: z.string().optional(),
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  visitId: z.string().min(1),
  patientRef: z.string().min(1),
  patientOrigin: z.string().min(1),
  reservationId: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

function serviceToken(request: Request): boolean {
  const expected =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.POS_BRIDGE_SECRET?.trim() ||
    "";
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/prescription-queue", async (httpReq, httpRes) => {
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

  
    if (!serviceToken(request)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = createSchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const row = await createPrescriptionQueueRow({
      organizationId: requestOrganizationId() || body.organizationId,
      visitId: body.visitId,
      patientRef: body.patientRef,
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId ?? null,
      linesJson: JSON.stringify(body.lines),
    });
    return sendJson(httpRes, { id: row.id, status: row.status }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
