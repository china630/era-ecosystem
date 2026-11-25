import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, Delete, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateResource, deleteResource, auditMasterChange } from "@/lib/services/clinic-master-data.service";


const updateSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(["ROOM", "EQUIPMENT"]).optional(),
  capacity: z.number().int().positive().optional(),
  roomId: z.string().nullable().optional(),
  extendedStartHour: z.number().int().min(0).max(23).nullable().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
  sexAudience: z.enum(["MALE", "FEMALE", "ANY"]).optional(),
});

@Controller()
export class AdminResourcesIdController {

  @Patch("api/admin/resources/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateResource(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "resource",
      id,
      "UPDATE",
      body,
    );
    return row;
  
        });
  }

  @Delete("api/admin/resources/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteResource(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "resource",
      id,
      "DELETE",
    );
    return { deleted: true };
  
        });
  }
}
