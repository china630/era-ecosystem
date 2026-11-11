import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CP_PERMISSION } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { OrganizationProfileService } from "./organization-profile.service";
import { GuestAppService } from "./guest-app.service";

@Controller("platform/v1/organizations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuestAppController {
  constructor(
    private readonly guestApp: GuestAppService,
    private readonly profiles: OrganizationProfileService,
  ) {}

  @Get("me/guest-app")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  async getMine(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.guestApp.getBrand(user.organizationId);
  }

  @Patch("me/guest-app")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  async patchMine(@CurrentUser() user: EraJwtPayload, @Body() body: unknown) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.guestApp.patchBrand(user.organizationId, user.sub, body);
  }

  @Get(":id/guest-app")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  async get(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) organizationId: string,
  ) {
    if (user.organizationId !== organizationId && !user.isSuperAdmin) {
      await this.profiles.assertOrgMember(user.sub, organizationId);
    }
    return this.guestApp.getBrand(organizationId);
  }

  @Patch(":id/guest-app")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  async patch(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() body: unknown,
  ) {
    if (user.organizationId !== organizationId && !user.isSuperAdmin) {
      await this.profiles.assertOrgMember(user.sub, organizationId);
    }
    return this.guestApp.patchBrand(organizationId, user.sub, body);
  }
}

/** Phone reads this. No service token in the binary. Brand is not a secret. */
@Public()
@Controller("platform/v1/guest-app")
export class GuestAppPublicController {
  constructor(private readonly guestApp: GuestAppService) {}

  @Get(":organizationId/brand")
  brand(@Param("organizationId", ParseUUIDPipe) organizationId: string) {
    return this.guestApp.getBrand(organizationId);
  }
}
