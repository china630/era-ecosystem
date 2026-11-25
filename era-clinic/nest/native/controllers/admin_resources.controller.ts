import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Get, HttpCode, Post, Req, Res, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listResources, createResource, auditMasterChange } from "@/lib/services/clinic-master-data.service";


const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["ROOM", "EQUIPMENT"]).default("EQUIPMENT"),
  capacity: z.number().int().positive().optional(),
  roomId: z.string().nullable().optional(),
  extendedStartHour: z.number().int().min(0).max(23).nullable().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
  sexAudience: z.enum(["MALE", "FEMALE", "ANY"]).optional(),
});

@Controller()
export class AdminResourcesController {

  @Get("api/admin/resources")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listResources();
  
        });
  }

  @Post("api/admin/resources")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createResource(body);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "resource",
      row.id,
      "CREATE",
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
