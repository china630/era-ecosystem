import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listLisFileProfiles, createLisFileProfile } from "@/lib/services/clinic-master-data.service";


const bodySchema = z.object({
  name: z.string().min(1),
  format: z.enum(["CSV", "HL7_FRAGMENT"]).default("CSV"),
  delimiter: z.string().default(","),
  columnMapping: z.record(z.string()).default({}),
});

@Controller()
export class AdminLisProfilesController {

  @Get("api/admin/lis-profiles")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const profiles = await listLisFileProfiles();
    return profiles;
  
        });
  }

  @Post("api/admin/lis-profiles")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = bodySchema.parse(httpReq.body);
    const profile = await createLisFileProfile({
      name: body.name,
      format: body.format,
      delimiter: body.delimiter,
      columnMappingJson: JSON.stringify(body.columnMapping),
    });
    throw new HttpException(profile, 201);
  
        });
  }
}
