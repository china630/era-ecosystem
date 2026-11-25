import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  fetchWorkforcePicker,
  filterWorkforcePicker,
} from "@/lib/workforce-picker";

@Controller()
export class SanatoriumWorkforcePickerController {
  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/workforce-picker")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
      );
      if (denied) return clinicBody(denied);

      let organizationId: string;
      try {
        const id = requestOrganizationId();
        organizationId = id === "demo-org" ? session.organizationId : id;
      } catch {
        organizationId = session.organizationId;
      }

      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const q = url.searchParams.get("q") ?? undefined;
      const picker = await fetchWorkforcePicker(organizationId);
      if (picker.unavailable) {
        throw new HttpException(
          { error: "Workforce picker unavailable", code: "WORKFORCE_UNAVAILABLE" },
          503,
        );
      }
      return { items: filterWorkforcePicker(picker.items, q) };
    });
  }
}
