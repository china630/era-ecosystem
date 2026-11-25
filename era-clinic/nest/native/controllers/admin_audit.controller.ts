import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listAdminSatelliteAuditLogs } from "@/domain/auth/admin-audit.service";

@Controller()
export class AdminAuditController {

  @Get("api/admin/audit")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const entityType = url.searchParams.get("entityType") ?? "HTTP_MUTATION";
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const dateFromParam = url.searchParams.get("dateFrom");
    const dateToParam = url.searchParams.get("dateTo");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)) {
      createdAt.gte = bakuDayBounds(dateFromParam).start;
    }
    if (dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)) {
      createdAt.lte = bakuDayBounds(dateToParam).end;
    }
    const rows = await listAdminSatelliteAuditLogs({
      entityType,
      entityId,
      action,
      userId,
      createdAt,
      limit,
    });
    return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: JSON.parse(r.changesJson || "{}"),
        createdAt: r.createdAt.toISOString(),
      }));
  
        });
  }
}
