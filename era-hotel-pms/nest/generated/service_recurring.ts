import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runCronForEachTenant } from '@era/satellite-kit';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { createRecurringServiceSchedule, listRecurringServiceSchedules, runDueRecurringSchedules } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  cadence: z.enum([
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY',
    'DATE',
    'EVENT',
  ]),
  nextDueAt: z.string().datetime(),
  roomId: z.string().uuid().optional(),
  location: z.string().optional(),
  eventKey: z.string().optional(),
});





/**
 * Cron hook: generate work orders for due schedules (multi-org via orch pool registry).
 * Auth: Authorization Bearer SERVICE_CRON_SECRET, or legacy x-service-cron-secret = raw secret.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/service/recurring", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const rows = await listRecurringServiceSchedules();
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/service/recurring", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const row = await createRecurringServiceSchedule({
      organizationId: session.organizationId,
      title: body.title,
      category: body.category,
      cadence: body.cadence,
      nextDueAt: new Date(body.nextDueAt),
      roomId: body.roomId,
      location: body.location,
      eventKey: body.eventKey,
    });
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/service/recurring", async (httpReq, httpRes) => {
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

  const legacy = req.headers.get('x-service-cron-secret');
  const authorization =
    req.headers.get('authorization') ??
    (legacy ? `Bearer ${legacy}` : null);

  const gate = await runCronForEachTenant(
    {
      satelliteKey: 'industry_hotel_pms',
      moduleKey: 'hotel_service',
      authorization,
      cronSecretEnv: 'SERVICE_CRON_SECRET',
      fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
    },
    async (organizationId) => {
      const created = await runDueRecurringSchedules();
      return {
        organizationId,
        generated: created.length,
        ids: created.map((c) => c.id),
      };
    },
  );

  if (!gate.ok) {
    if (gate.status === 401) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    if (gate.status === 503) {
      return sendJson(httpRes, { error: gate.reason }, 503);
    }
    return sendJson(httpRes, {
      generated: 0,
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
  }

  return sendJson(httpRes, { byOrganization: gate.results });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
