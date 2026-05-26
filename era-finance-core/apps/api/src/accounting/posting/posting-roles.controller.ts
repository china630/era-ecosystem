import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { requireOrgRole } from "../../auth/require-org-role";
import type { AuthUser } from "../../auth/types/auth-user";
import { OrganizationId } from "../../common/org-id.decorator";
import { PostingRolesService } from "./posting-roles.service";

class PatchPostingRoleDto {
  accountCode!: string;
}

@Controller("accounting/posting-roles")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostingRolesController {
  constructor(private readonly postingRoles: PostingRolesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  list(@OrganizationId() organizationId: string) {
    return this.postingRoles.listForOrganization(organizationId);
  }

  @Patch(":role")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  clear(
    @OrganizationId() organizationId: string,
    @Param("role") role: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postingRoles.clearOverride(organizationId, role, requireOrgRole(user));
  }
}
