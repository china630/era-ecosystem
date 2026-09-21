import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { OrganizationId } from "../common/org-id.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ApproveAccessDto } from "./dto/approve-access.dto";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { requireOrgRole } from "./require-org-role";
import type { AuthUser } from "./types/auth-user";
import { AuthService } from "./auth.service";
import { ControlPlaneClient } from "../control-plane/control-plane.client";

@ApiTags("team")
@ApiBearerAuth("bearer")
@Controller("team")
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(
    private readonly auth: AuthService,
    private readonly controlPlane: ControlPlaneClient,
  ) {}

  @Get("members")
  @ApiOperation({ summary: "Участники текущей организации" })
  members(@OrganizationId() organizationId: string) {
    return this.auth.listMembers(organizationId);
  }

  @Delete("members/:userId")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  @ApiOperation({ summary: "Исключить участника (не OWNER)" })
  removeMember(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.auth.removeMember(
      organizationId,
      targetUserId,
      user.userId,
      requireOrgRole(user),
    );
  }

  @Get("access-requests")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Ожидающие запросы на вступление по VÖEN" })
  accessRequests(
    @OrganizationId() organizationId: string,
    @Headers("authorization") authorization?: string,
  ) {
    if (this.controlPlane.rbacProxyEnabled && authorization) {
      return this.controlPlane.forward({
        method: "GET",
        path: "/team/access-requests",
        authorization,
      });
    }
    return this.auth.listPendingAccessRequests(organizationId);
  }

  @Post("access-requests/:id/approve")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  @ApiOperation({ summary: "Принять запрос на доступ" })
  approveAccess(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Param("id") requestId: string,
    @Body() dto: ApproveAccessDto,
    @Headers("authorization") authorization?: string,
  ) {
    if (this.controlPlane.rbacProxyEnabled && authorization) {
      return this.controlPlane.forward({
        method: "POST",
        path: `/team/access-requests/${requestId}/approve`,
        body: dto,
        authorization,
      });
    }
    return this.auth.decideAccessRequest(
      organizationId,
      requestId,
      user.userId,
      requireOrgRole(user),
      true,
      dto.role ?? UserRole.USER,
    );
  }

  @Post("access-requests/:id/decline")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  @ApiOperation({ summary: "Отклонить запрос на доступ" })
  declineAccess(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Param("id") requestId: string,
    @Headers("authorization") authorization?: string,
  ) {
    if (this.controlPlane.rbacProxyEnabled && authorization) {
      return this.controlPlane.forward({
        method: "POST",
        path: `/team/access-requests/${requestId}/decline`,
        authorization,
      });
    }
    return this.auth.decideAccessRequest(
      organizationId,
      requestId,
      user.userId,
      requireOrgRole(user),
      false,
      UserRole.USER,
    );
  }

  @Post("invites")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  @ApiOperation({ summary: "Пригласить пользователя по email" })
  createInvite(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.auth.createInvite(
      organizationId,
      dto.email,
      dto.role,
      user.userId,
    );
  }

  @Get("invites")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Список активных приглашений организации" })
  invites(@OrganizationId() organizationId: string) {
    return this.auth.listOrganizationInvites(organizationId);
  }

  @Post("invites/:id/revoke")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_ORG_MEMBERS_WRITE)
  @ApiOperation({ summary: "Отозвать приглашение" })
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @OrganizationId() organizationId: string,
    @Param("id") inviteId: string,
  ) {
    return this.auth.revokeInvite(
      organizationId,
      inviteId,
      requireOrgRole(user),
    );
  }
}
