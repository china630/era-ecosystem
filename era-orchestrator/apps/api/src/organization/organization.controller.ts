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
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import {
  ApproveAccessDto,
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

  @Get("team/access-requests")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  listAccessRequests(@CurrentUser() user: EraJwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return this.org.listPendingAccessRequests(user.organizationId);
  }

  @Post("team/access-requests/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
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
    );
  }

  @Post("team/access-requests/:id/decline")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
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
}
