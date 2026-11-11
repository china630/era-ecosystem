import { z } from "zod";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { getElektrawebBridgePolicy, isPolicyWriteEnabled } from "@/lib/integration/elektraweb-bridge/config";
import { claimPendingOutbox, enqueueElektrawebOutbox, ElektrawebOutboxError } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { verifyPosBridge } from "@/lib/pos-bridge-auth";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  source: z.enum(["CLINIC", "FNB"]).default("CLINIC"),
  idempotencyKey: z.string().min(4).max(120),
  patientOrigin: z.enum(["IN_HOUSE", "WALK_IN"]),
  reservationId: z.string().uuid().optional(),
  procedureCode: z.string().min(1),
  procedureName: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/integrations/elektraweb-bridge/outbox", async (httpReq, httpRes) => {
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

  
    const auth = await authenticateBridgeRequest(request);
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const writeEnabled = isPolicyWriteEnabled(policy);
    if (!writeEnabled) {
      return sendJson(httpRes, { writeEnabled: false, organizationId: auth.organizationId, items: [] });
    }
    const claimed = await claimPendingOutbox(auth.organizationId, 5);
    return sendJson(httpRes, {
      writeEnabled: true,
      organizationId: auth.organizationId,
      items: claimed.map((row) => ({
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        insert: {
          urlPath: "/Execute/SP_SPA_SAVE",
          body: row.insertPayload,
        },
      })),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/integrations/elektraweb-bridge/outbox", async (httpReq, httpRes) => {
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

  try {
    const body = enqueueSchema.parse(httpReq.body);
    if (!verifyPosBridge(request)) {
      const auth = await authenticateBridgeRequest(request);
      if (auth.organizationId !== body.organizationId) {
        return sendJson(httpRes, 
          { error: "organizationId does not match bridge token org" }, 403);
      }
    }
    enterSatelliteTenant({ organizationId: body.organizationId });
    const row = await enqueueElektrawebOutbox({
      organizationId: body.organizationId,
      source: body.source,
      idempotencyKey: body.idempotencyKey,
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId,
      procedureCode: body.procedureCode,
      procedureName: body.procedureName,
      amount: body.amount,
      description: body.description,
    });
    return sendJson(httpRes, 
      {
        id: row.id,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        elektrawebResNameId: row.elektrawebResNameId,
        organizationId: row.organizationId,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ElektrawebOutboxError) {
      return sendRouteError(httpRes, err);
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
