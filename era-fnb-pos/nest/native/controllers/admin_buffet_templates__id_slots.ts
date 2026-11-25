/** Lifted from nest/generated/admin_buffet_templates__id_slots.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { describeRouteError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { BUFFET_MEALS } from "@/lib/buffet-planner-math";
import { deleteWeekTemplateSlot, upsertWeekTemplateSlot } from "@/lib/buffet-week-template.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  menuItemId: z.string().min(1),
  station: z.string().min(1).max(40).optional(),
  plannedPortions: z.number().int().min(1).max(50000),
  wastePct: z.number().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const upsertSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  meal: z.enum(BUFFET_MEALS),
  coversAdult: z.number().int().min(0).max(5000),
  coversChild: z.number().int().min(0).max(5000).default(0),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(lineSchema).optional(),
});

const deleteSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  meal: z.enum(BUFFET_MEALS),
});

function mapCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "TEMPLATE_NOT_FOUND") return { status: 404, body: { error: "Template not found" } };
    if (code === "MENU_ITEM_NOT_FOUND") return { status: 404, body: { error: "Menu item not found on this outlet" } };
    if (code === "INVALID_WEEKDAY" || code === "INVALID_MEAL") {
      return { status: 400, body: { error: "Invalid weekday or meal" } };
    }
  }
  return null;
}


@Controller()
export class AdminBuffetTemplatesIdSlotsController {
  @Put("api/admin/buffet/templates/:id/slots")
  @HttpCode(200)
  async put_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = httpReq.params;
    const body = upsertSchema.parse(httpReq.body);
    return sendJson(httpRes, await upsertWeekTemplateSlot(id, body));
  } catch (err) {
    const described = mapCode(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Delete("api/admin/buffet/templates/:id/slots")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const { id } = httpReq.params;
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    // Prefer query (DELETE bodies are unreliable in browsers); JSON body still accepted.
    const fromQuery = {
      weekday: url.searchParams.get("weekday"),
      meal: url.searchParams.get("meal"),
    };
    let raw: unknown = fromQuery;
    if (fromQuery.weekday == null || fromQuery.meal == null) {
      raw = (httpReq.body ?? {});
    } else {
      raw = {
        weekday: Number(fromQuery.weekday),
        meal: fromQuery.meal,
      };
    }
    const body = deleteSchema.parse(raw);
    return sendJson(httpRes, await deleteWeekTemplateSlot(id, body.weekday, body.meal));
  } catch (err) {
    const described = mapCode(err) ?? describeRouteError(err);
    return sendJson(httpRes, described.body, described.status);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
