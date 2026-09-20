import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateManualGrantDto,
  ListManualGrantsQueryDto,
} from "./dto/workforce-manual-grant.dto";
import { WorkforceManualGrantService } from "./workforce-manual-grant.service";

@ApiTags("platform-workforce-manual-grants")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/manual-grants")
@UseGuards(PermissionsGuard)
export class WorkforceManualGrantsController {
  constructor(private readonly grants: WorkforceManualGrantService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS)
  list(
    @OrganizationId() organizationId: string,
    @Query() query: ListManualGrantsQueryDto,
  ) {
    return this.grants.list(organizationId, {
      employmentId: query.employmentId,
      satelliteKey: query.satelliteKey,
      revoked: query.revoked,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateManualGrantDto,
  ) {
    return this.grants.grant(organizationId, user.sub, dto);
  }

  @Post(":id/revoke")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS)
  revoke(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.grants.revoke(organizationId, id, user.sub);
  }

  @Post(":id/restore")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS)
  @ApiOperation({ summary: "Restore a revoked manual satellite grant" })
  restore(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.grants.restore(organizationId, id, user.sub);
  }
}
