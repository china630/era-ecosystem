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
import { updateRoom, deleteRoom, auditMasterChange } from "@/lib/services/clinic-master-data.service";


const updateSchema = z.object({
  name: z.string().min(1).optional(),
});

@Controller()
export class AdminRoomsIdController {

  @Patch("api/admin/rooms/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateRoom(id, body);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "room",
      id,
      "UPDATE",
      body,
    );
    return row;
  
        });
  }

  @Delete("api/admin/rooms/:id")
  @HttpCode(200)
  async delete_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    await deleteRoom(id);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "room",
      id,
      "DELETE",
    );
    return { deleted: true };
  
        });
  }
}
