/** Lifted from era-hotel-pms/nest/generated/admin_audit.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuDayBounds } from '@era/satellite-kit/time';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listAuditLogs } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminAuditController {
  @Get("api/admin/audit")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = requestUrl;
    const entityType = url.searchParams.get('entityType') ?? 'HTTP_MUTATION';
    if (!entityType.trim()) {
      return sendJson(httpRes, { error: 'entityType required' }, 400);
    }
    const entityId = url.searchParams.get('entityId') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const userId = url.searchParams.get('userId') ?? undefined;
    const dateFromParam = url.searchParams.get('dateFrom');
    const dateToParam = url.searchParams.get('dateTo');
    const dateFrom =
      dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)
        ? bakuDayBounds(dateFromParam).start
        : dateFromParam
          ? new Date(dateFromParam)
          : undefined;
    const dateTo =
      dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)
        ? bakuDayBounds(dateToParam).end
        : dateToParam
          ? new Date(`${dateToParam}T23:59:59.999Z`)
          : undefined;
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);
    const rows = await listAuditLogs({
      entityType,
      entityId,
      action,
      userId,
      dateFrom,
      dateTo,
      limit,
    });
    return sendJson(httpRes, 
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: JSON.parse(r.changesJson),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
