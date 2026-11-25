import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listRooms, createRoom, updateRoom, deleteRoom, auditMasterChange } from "@/lib/services/clinic-master-data.service";


const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
});

@Controller()
export class AdminRoomsController {

  @Get("api/admin/rooms")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    return await listRooms();
  
        });
  }

  @Post("api/admin/rooms")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createRoom(body);
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "room",
      row.id,
      "CREATE",
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
