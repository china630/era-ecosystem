/** Lifted from era-hotel-pms/nest/generated/service_recurring.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { runCronForEachTenant } from '@era/satellite-kit';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { createRecurringServiceSchedule, listRecurringServiceSchedules, runDueRecurringSchedules } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class ServiceRecurringController {
  @Get("api/service/recurring")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const rows = await listRecurringServiceSchedules();
    return sendJson(httpRes, rows);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/service/recurring")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/service/recurring")
  @HttpCode(200)
  async put_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  const legacy = nestHeader(httpReq, 'x-service-cron-secret');
  const authorization =
    nestHeader(httpReq, 'authorization') ??
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
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
