import { z } from 'zod';
import { enterRequestTenant } from '@/lib/request-organization';
import { openEpisodeFromStay } from '@/lib/services/sanatorium.service';
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  reservationId: z.string(),
  hotelStayId: z.string().nullable().optional(),
  guestName: z.string().min(1),
  passportNumber: z.string().min(1),
  phone: z.string().optional(),
  organizationId: z.string().min(1),
  globalPersonId: z.string().nullable().optional(),
  /** Medical package / program template code from hotel rate stamp. */
  programCode: z.string().min(1).nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  paxKey: z.string().nullable().optional(),
  sex: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
});

/** SEC-CLI-01: fail closed in production when CLINIC_BRIDGE_SECRET unset */
function assertBridgeSecret(req: Request) {
  const expected = process.env.CLINIC_BRIDGE_SECRET?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid bridge secret');
    }
    return;
  }
  const got = req.headers.get('x-clinic-bridge-secret');
  if (got !== expected) {
    throw new Error('Invalid bridge secret');
  }
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/sanatorium/episodes/from-stay", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
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
    assertBridgeSecret(req);
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const episode = await openEpisodeFromStay(body);
    return sendJson(httpRes, episode);
  } catch (err) {
    if (err instanceof Error && err.message === 'Invalid bridge secret') {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
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
