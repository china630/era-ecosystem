/** Lifted from nest/generated/halls.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createPosHall, findPosHallWithHighestSortOrder, listPosHallNamesForOutlet, listPosHallsForOutlet } from "@/lib/hall.service";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TABLES } from "@/lib/auth/read-permission-sets";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});


@Controller()
export class HallsController {
  @Get("api/halls")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TABLES);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const outlet = await resolveOpsOutlet();
    const halls = await listPosHallsForOutlet(outlet.id);
    return sendJson(httpRes, 
      halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        sortOrder: hall.sortOrder,
        tableCount: hall._count.tables,
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/halls")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = createSchema.parse(httpReq.body);
    const outlet = await resolveOpsOutlet();
    const taken = await listPosHallNamesForOutlet(outlet.id);
    const key = body.name.toLocaleLowerCase();
    if (taken.some((row) => row.name.trim().toLocaleLowerCase() === key)) {
      return sendJson(httpRes, { error: "Hall already exists", code: "HALL_DUPLICATE" }, 409);
    }
    const last = await findPosHallWithHighestSortOrder(outlet.id);
    const hall = await createPosHall({
      organizationId: requestOrganizationId(),
      outletId: outlet.id,
      name: body.name,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    });
    return sendJson(httpRes, hall, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
