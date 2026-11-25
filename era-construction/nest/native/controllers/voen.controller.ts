import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { fetchVoenPreview } from "@era/satellite-kit";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import { queryParam, type ConstructionRequest } from "../session";

@Controller("api/counterparties")
@UseGuards(ConstructionStaffGuard)
export class VoenController {
  @Get("voen-preview")
  preview(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, () => fetchVoenPreview(queryParam(req, "voen") ?? ""));
  }
}
