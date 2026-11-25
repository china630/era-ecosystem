/** Lifted from nest/generated/menu_sold-out.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { isSoldOutSchemaDrift, listMenuItemSoldOutRows, upsertMenuItemSoldOut } from "@/lib/fnb-sold-out";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_SOLD_OUT } from "@/lib/auth/read-permission-sets";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  outletId: z.string().optional(),
  soldOut: z.boolean(),
});


@Controller()
export class MenuSoldOutController {
  @Get("api/menu/sold-out")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessAnyPermission(session, TILL_READ_SOLD_OUT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const outletId =
      new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString()).searchParams.get("outletId") ??
      (await getSelectedOutletId());
    const rows = await listMenuItemSoldOutRows(requestOrganizationId(), outletId ?? undefined);
    return sendJson(httpRes, { soldOut: rows.filter((r) => r.soldOut) });
  } catch (err) {
    if (isSoldOutSchemaDrift(err)) return sendJson(httpRes, { soldOut: [] });
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Put("api/menu/sold-out")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_SOLD_OUT);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = bodySchema.parse(httpReq.body);
    const outletId = body.outletId ?? (await getSelectedOutletId());
    if (!outletId) return sendJson(httpRes, { error: "outletId required" }, 400);
    const organizationId = requestOrganizationId();
    const row = await upsertMenuItemSoldOut({
      organizationId,
      menuItemId: body.menuItemId,
      outletId,
      soldOut: body.soldOut,
    });
    return sendJson(httpRes, row);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
