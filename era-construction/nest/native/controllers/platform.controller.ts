import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

@Controller("api/platform")
@UseGuards(ConstructionStaffGuard)
export class PlatformController {
  @Get("billing-snapshot")
  snapshot(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      const organizationId = session.organizationId;
      if (!organizationId) {
        return { skipped: true, reason: "satellite organizationId not bound" };
      }
      return getSubscriptionMe({ organizationId });
    });
  }
}
