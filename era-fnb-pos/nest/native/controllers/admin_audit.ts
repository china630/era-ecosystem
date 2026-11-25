/** Lifted from nest/generated/admin_audit.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { queryAdminAuditLogs } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminAuditController {
  @Get("api/admin/audit")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    assertPermission(session, PERMISSIONS.SCREEN_ADMIN_AUDIT);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const entityType = url.searchParams.get("entityType") ?? "HTTP_MUTATION";
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const dateFromParam = url.searchParams.get("dateFrom");
    const dateToParam = url.searchParams.get("dateTo");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
    if (!entityType.trim()) {
      return sendJson(httpRes, { error: "entityType required" }, 400);
    }
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)) {
      createdAt.gte = bakuDayBounds(dateFromParam).start;
    }
    if (dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)) {
      createdAt.lte = bakuDayBounds(dateToParam).end;
    }
    const rows = await queryAdminAuditLogs({
      entityType,
      entityId,
      action,
      userId,
      createdAt,
      limit,
    });
    return sendJson(httpRes, 
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: JSON.parse(r.changesJson || "{}"),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
