import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { requireOrgRole } from "../../auth/require-org-role";
import type { AuthUser } from "../../auth/types/auth-user";
import { OrganizationId } from "../../common/org-id.decorator";
import { PostingRolesService } from "./posting-roles.service";

class PatchPostingRoleDto {
  accountCode!: string;
}

@Controller("accounting/posting-roles")
@UseGuards(JwtAuthGuard)
export class PostingRolesController {
  constructor(private readonly postingRoles: PostingRolesService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  list(@OrganizationId() organizationId: string) {
    return this.postingRoles.listForOrganization(organizationId);
  }

  @Patch(":role")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  patch(
    @OrganizationId() organizationId: string,
    @Param("role") role: string,
    @Body() dto: PatchPostingRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postingRoles.patchRole(
      organizationId,
      role,
      dto.accountCode,
      requireOrgRole(user),
    );
  }

  @Delete(":role")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  clear(
    @OrganizationId() organizationId: string,
    @Param("role") role: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postingRoles.clearOverride(organizationId, role, requireOrgRole(user));
  }
}
