import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CP_PERMISSION, CP_CUSTOM_ROLE_CODE_RE } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { CpAccessService } from "./cp-access.service";
import { AuthService } from "../auth/auth.service";

class PatchPermissionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  resetToDefaults?: boolean;
}

class CloneRoleDto {
  @IsString()
  @Matches(CP_CUSTOM_ROLE_CODE_RE)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(32)
  cloneFrom!: string;
}

@ApiTags("cp-access")
@ApiBearerAuth("bearer")
@Controller("platform/v1/access")
@UseGuards(PermissionsGuard)
export class CpAccessController {
  constructor(
    private readonly access: CpAccessService,
    private readonly auth: AuthService,
  ) {}

  private orgId(user: EraJwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return user.organizationId;
  }

  @Get("catalog")
  @RequirePermissions(CP_PERMISSION.SCREEN_SETTINGS_ACCESS)
  catalog() {
    return this.access.catalog();
  }

  @Get("roles")
  @RequirePermissions(CP_PERMISSION.SCREEN_SETTINGS_ACCESS)
  listRoles(@CurrentUser() user: EraJwtPayload) {
    return this.access.listRoles(this.orgId(user));
  }

  @Get("roles/:code/permissions")
  @RequirePermissions(CP_PERMISSION.SCREEN_SETTINGS_ACCESS)
  getPermissions(
    @CurrentUser() user: EraJwtPayload,
    @Param("code") code: string,
  ) {
    return this.access.getRolePermissions(this.orgId(user), code);
  }

  @Patch("roles/:code/permissions")
  @RequirePermissions(CP_PERMISSION.ADMIN_ACCESS_MANAGE)
  async patchPermissions(
    @CurrentUser() user: EraJwtPayload,
    @Param("code") code: string,
    @Body() body: PatchPermissionsDto,
  ) {
    const result = await this.access.patchRolePermissions(
      this.orgId(user),
      code,
      body,
    );
    return result;
  }

  @Post("roles")
  @RequirePermissions(CP_PERMISSION.ADMIN_ACCESS_MANAGE)
  cloneRole(@CurrentUser() user: EraJwtPayload, @Body() body: CloneRoleDto) {
    return this.access.cloneRole(this.orgId(user), body);
  }

  @Delete("roles/:code")
  @RequirePermissions(CP_PERMISSION.ADMIN_ACCESS_MANAGE)
  deleteRole(
    @CurrentUser() user: EraJwtPayload,
    @Param("code") code: string,
  ) {
    return this.access.deleteRole(this.orgId(user), code);
  }

  /** Re-issue access token so page/sidebar JWT matches DB after matrix save. */
  @Post("session/refresh-permissions")
  @RequirePermissions(CP_PERMISSION.SCREEN_SETTINGS_ACCESS)
  async refreshPermissions(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    const switched = await this.auth.switchOrganization(
      user.sub,
      user.organizationId,
    );
    return {
      ok: true,
      accessToken: switched.accessToken,
      refreshToken: switched.refreshToken,
      permissions: switched.claims.permissions ?? [],
    };
  }
}
