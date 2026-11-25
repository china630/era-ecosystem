import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listNahiyeQueue } from "@/domain/physio/nahiye-cutover.service";

@Controller()
export class AdminPhysioNahiyeQueueController {

  @Get("api/admin/physio-nahiye-queue")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const rows = await listNahiyeQueue({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return rows;
  
        });
  }
}
