import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";

import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole, WorkforceEmploymentStatus } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceHoldingService } from "./workforce-holding.service";

@ApiTags("platform-workforce-holding")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@UseGuards(PermissionsGuard)
export class WorkforceHoldingController {
  constructor(private readonly holdingHr: WorkforceHoldingService) {}

  @Get("holding-directory")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HOLDING)
  @ApiOperation({
    summary:
      "Federated HR directory: people across holding orgs where caller has OWNER/HR_MANAGER. Paginate by person.",
  })
  directory(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("holdingId") holdingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("status") statusRaw?: string,
    @Query("organizationId") filterOrgId?: string,
    @Query("q") q?: string,
  ) {
    const id = holdingId?.trim();
    if (!id) {
      throw new BadRequestException({
        code: "HOLDING_ID_REQUIRED",
        message: "holdingId query is required",
      });
    }
    const status =
      statusRaw &&
      Object.values(WorkforceEmploymentStatus).includes(
        statusRaw as WorkforceEmploymentStatus,
      )
        ? (statusRaw as WorkforceEmploymentStatus)
        : undefined;
    return this.holdingHr.directory(user.sub, organizationId, id, {
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 40)),
      status,
      organizationId: filterOrgId,
      q,
    });
  }

  @Get("persons/:globalPersonId/employments")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HOLDING)
  @ApiOperation({
    summary:
      "Person card: employments in holding orgs (holdingId) or all HR STANDALONE memberships",
  })
  personEmployments(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("globalPersonId") globalPersonId: string,
    @Query("holdingId") holdingId?: string,
  ) {
    return this.holdingHr.personEmployments(
      user.sub,
      organizationId,
      holdingId?.trim() || null,
      globalPersonId,
    );
  }
}
