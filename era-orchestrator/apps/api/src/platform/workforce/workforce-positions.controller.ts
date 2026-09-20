import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole, OrgUnitStatus } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateWorkforcePositionDto,
  UpdateWorkforcePositionDto,
} from "./dto/workforce-org.dto";
import { WorkforcePositionsService } from "./workforce-positions.service";

@ApiTags("platform-workforce-positions")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/positions")
@UseGuards(PermissionsGuard)
export class WorkforcePositionsController {
  constructor(private readonly positions: WorkforcePositionsService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List workforce positions" })
  list(
    @OrganizationId() organizationId: string,
    @Query("orgUnitId") orgUnitId?: string,
    @Query("status") statusRaw?: string,
  ) {
    const status =
      statusRaw === "ACTIVE" || statusRaw === "ARCHIVED"
        ? (statusRaw as OrgUnitStatus)
        : undefined;
    return this.positions.list(organizationId, orgUnitId?.trim(), status);
  }

  @Post()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforcePositionDto,
  ) {
    return this.positions.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforcePositionDto,
  ) {
    return this.positions.update(organizationId, id, user.sub, dto);
  }

  @Post(":id/archive")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  @ApiOperation({ summary: "Archive position (no active employments)" })
  archive(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.positions.archive(organizationId, id, user.sub);
  }
}
