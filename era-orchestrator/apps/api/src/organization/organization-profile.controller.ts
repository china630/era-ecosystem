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
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CP_PERMISSION } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { OrganizationProfileService } from "./organization-profile.service";

@Controller("platform/v1/organizations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationProfileController {
  constructor(private readonly profiles: OrganizationProfileService) {}

  /** Static `me` routes must precede `:id` or Nest treats "me" as a UUID. */
  @Get("me/profile")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  async getMine(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.profiles.getSnapshot(user.organizationId);
  }

  @Patch("me/profile")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  async patchMine(@CurrentUser() user: EraJwtPayload, @Body() body: unknown) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.profiles.patchProfile(user.organizationId, user.sub, body);
  }

  @Get(":id/profile")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  async get(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) organizationId: string,
  ) {
    if (user.organizationId !== organizationId && !user.isSuperAdmin) {
      await this.profiles.assertOrgMember(user.sub, organizationId);
    }
    return this.profiles.getSnapshot(organizationId);
  }

  @Patch(":id/profile")
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  async patch(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() body: unknown,
  ) {
    if (user.organizationId !== organizationId && !user.isSuperAdmin) {
      await this.profiles.assertOrgMember(user.sub, organizationId);
    }
    return this.profiles.patchProfile(organizationId, user.sub, body);
  }
}
