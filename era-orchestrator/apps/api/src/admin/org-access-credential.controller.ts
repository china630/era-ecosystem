import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { CP_PERMISSION } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { UpsertOrgAccessDto } from "./dto/upsert-org-access.dto";
import { OrgAccessCredentialService } from "./org-access-credential.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/orgs/:orgId/access")
export class OrgAccessCredentialController {
  constructor(private readonly service: OrgAccessCredentialService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.list(orgId);
  }

  @Put(":code")
  upsert(
    @CurrentUser() user: EraJwtPayload,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("code") code: string,
    @Body() body: UpsertOrgAccessDto,
  ) {
    return this.service.upsert(orgId, code, body, user.sub);
  }

  @Post(":code/check")
  check(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("code") code: string,
  ) {
    return this.service.checkStored(orgId, code);
  }
}
