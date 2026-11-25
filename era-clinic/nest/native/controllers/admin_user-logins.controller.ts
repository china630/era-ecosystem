import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listUserLogins } from "@/domain/auth/user-login.service";

@Controller()
export class AdminUserLoginsController {

  @Get("api/admin/user-logins")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const rows = await listUserLogins({
      organizationId: gate.session.organizationId,
      q: url.searchParams.get("q") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return rows;
  
        });
  }
}
