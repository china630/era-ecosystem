/** Lifted from nest/generated/tables__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { deletePosTable, findPosHallInOutlet, findPosTableById, updatePosTable } from "@/lib/hall.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  seats: z.number().int().positive().optional(),
  zone: z.string().nullable().optional(),
  hallId: z.string().nullable().optional(),
});


@Controller()
export class TablesIdController {
  @Patch("api/tables/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await findPosTableById(id);
    if (!existing) return sendJson(httpRes, { error: "Table not found" }, 404);
    if (body.hallId) {
      const hall = await findPosHallInOutlet(body.hallId, existing.outletId);
      if (!hall) return sendJson(httpRes, { error: "Hall not found" }, 404);
    }

    if (existing.status === "OCCUPIED" && (body.code || body.name)) {
      // Allow metadata edits while occupied; block delete only.
    }

    const table = await updatePosTable(id, {
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.seats !== undefined ? { seats: body.seats } : {}),
      ...(body.zone !== undefined ? { zone: body.zone } : {}),
      ...(body.hallId !== undefined ? { hallId: body.hallId } : {}),
    });
    return sendJson(httpRes, table);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Delete("api/tables/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const existing = await findPosTableById(id);
    if (!existing) return sendJson(httpRes, { error: "Table not found" }, 404);
    if (existing.status === "OCCUPIED" || existing.currentTicketId) {
      return sendJson(httpRes, 
        { error: "Cannot delete occupied table", code: "TABLE_OCCUPIED" }, 400);
    }

    await deletePosTable(id);
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
