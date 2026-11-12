import { z } from 'zod';
import { NextResponse } from 'next/server';
import { validateProcedureCompatibility } from '@/lib/procedure-compatibility.service';
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  procedureCode: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  existing: z.array(
    z.object({
      procedureCode: z.string(),
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
    }),
  ),
});

function verifyInternalToken(request: Request): boolean {
  const token =
    process.env.CLINIC_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${token}`;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/procedure-validate", async (httpReq, httpRes) => {
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

  if (!verifyInternalToken(request)) {
    return sendJson(httpRes, { error: 'Unauthorized' }, 401);
  }
  try {
    const body = schema.parse(httpReq.body);
    const violations = await validateProcedureCompatibility({
      candidateCode: body.procedureCode,
      startAt: body.startAt,
      endAt: body.endAt,
      existing: body.existing,
    });
    return sendJson(httpRes, { ok: violations.length === 0, violations });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    return sendJson(httpRes, { error: message }, 400);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
