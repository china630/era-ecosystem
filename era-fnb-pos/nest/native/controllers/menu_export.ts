/** Lifted from nest/generated/menu_export.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listMenuItemsForExport } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MenuExportController {
  @Get("api/menu/export")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const items = await listMenuItemsForExport(requestOrganizationId());

    const rows: Array<Record<string, unknown>> = [];
    for (const item of items) {
      if (item.priceHistory.length === 0) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(item.priceAzn),
          effectiveFrom: "",
          effectiveTo: "",
          reason: "current",
        });
        continue;
      }
      for (const h of item.priceHistory) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(h.priceAzn),
          effectiveFrom: h.effectiveFrom.toISOString(),
          effectiveTo: h.effectiveTo ? h.effectiveTo.toISOString() : "",
          reason: h.reason ?? "",
        });
      }
    }

    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "menu");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(Uint8Array.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="era-kafe-menu.xlsx"',
      },
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
