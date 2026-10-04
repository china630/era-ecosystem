import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CP_PERMISSION } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { FnbEditionService } from "./fnb-edition.service";

@ApiTags("fnb-edition")
@ApiBearerAuth("bearer")
@Controller("v1/fnb/edition")
@UseGuards(PermissionsGuard)
@RequirePermissions(CP_PERMISSION.API_BILLING_MANAGE)
export class FnbEditionController {
  constructor(private readonly editions: FnbEditionService) {}

  @Get()
  @ApiOperation({ summary: "F&B edition of the current org (owner only)" })
  state(@CurrentUser() user: EraJwtPayload, @OrganizationId() organizationId: string) {
    return this.editions.state(user.sub, organizationId);
  }

  @Post("upgrade")
  @ApiOperation({
    summary: "ERA Kafe → full F&B. No new price line; hotel mode and presets are not changed",
  })
  upgrade(@CurrentUser() user: EraJwtPayload, @OrganizationId() organizationId: string) {
    return this.editions.upgradeToFull(user.sub, organizationId);
  }
}
