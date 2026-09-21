import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CP_PERMISSION } from "../auth/cp-permissions";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import {
  ApproveAccessDto,
  CreateInviteDto,
  JoinOrgDto,
  TransferOwnershipDto,
} from "./dto/organization.dto";
import { OrganizationService } from "./organization.service";

@Controller()
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Post("auth/join-org")
  @UseGuards(JwtAuthGuard)
  joinOrg(@CurrentUser() user: EraJwtPayload, @Body() dto: JoinOrgDto) {
    return this.org.requestJoinByTaxId(user.sub, dto.taxId, dto.message);
  }

  @Get("v1/invites/pending")
  @UseGuards(JwtAuthGuard)
  listPendingInvites(@CurrentUser() user: EraJwtPayload) {
    return this.org.listPendingInvitesForEmail(user.email);
  }

  @Post("v1/invites/:id/accept")
  @UseGuards(JwtAuthGuard)
  acceptInvite(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") inviteId: string,
  ) {
    return this.org.acceptInvite(user.sub, user.email, inviteId);
  }

  @Get("team/access-requests")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  listAccessRequests(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.listPendingAccessRequests(user.organizationId);
  }

  @Get("team/members")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  listMembers(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.listMembers(user.organizationId);
  }

  @Get("team/invites")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_READ)
  listOrgInvites(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.listOrgInvites(user.organizationId);
  }

  @Post("team/invites")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_INVITES)
  createInvite(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateInviteDto,
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.createInvite(
      user.organizationId,
      user.sub,
      dto.email,
      dto.role ?? UserRole.USER,
      dto.organizationRoleCode,
    );
  }

  @Post("team/invites/:id/revoke")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_INVITES)
  revokeInvite(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") inviteId: string,
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.revokeInvite(user.organizationId, inviteId);
  }

  @Post("team/access-requests/:id/approve")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  approveAccess(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") requestId: string,
    @Body() dto: ApproveAccessDto,
  ) {
    if (!user.organizationId || !user.role) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.decideAccessRequest(
      user.organizationId,
      requestId,
      user.sub,
      user.role,
      true,
      dto.role ?? UserRole.USER,
      dto.organizationRoleCode,
    );
  }

  @Post("team/access-requests/:id/decline")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  declineAccess(
    @CurrentUser() user: EraJwtPayload,
    @Param("id") requestId: string,
  ) {
    if (!user.organizationId || !user.role) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.decideAccessRequest(
      user.organizationId,
      requestId,
      user.sub,
      user.role,
      false,
    );
  }

  @Post("organizations/transfer-ownership")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_TRANSFER_OWNERSHIP)
  transferOwnership(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: TransferOwnershipDto,
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.transferOwnership(
      user.sub,
      user.organizationId,
      dto.newOwnerUserId,
    );
  }

  @Get("organizations/departments")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CP_PERMISSION.API_ORG_DEPARTMENTS)
  listDepartments(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.listDepartments(user.organizationId);
  }
}
