import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateManualGrantDto,
  ListManualGrantsQueryDto,
} from "./dto/workforce-manual-grant.dto";
import { WorkforceManualGrantService } from "./workforce-manual-grant.service";

@ApiTags("platform-workforce-manual-grants")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/manual-grants")
@UseGuards(RolesGuard)
export class WorkforceManualGrantsController {
  constructor(private readonly grants: WorkforceManualGrantService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListManualGrantsQueryDto,
  ) {
    return this.grants.list(organizationId, query.employmentId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateManualGrantDto,
  ) {
    return this.grants.grant(organizationId, user.sub, dto);
  }

  @Post(":id/revoke")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  revoke(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.grants.revoke(organizationId, id, user.sub);
  }
}
