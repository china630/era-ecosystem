import {
  Body,
  Controller,
  Get,
  GoneException,
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
import { OrganizationId } from "../../common/org-id.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceTimesheetsService } from "./workforce-timesheets.service";
import {
  ApproveTimesheetEntriesDto,
  ListWorkforceTimesheetQueryDto,
  WorkforceTimesheetBatchUpdateDto,
} from "./dto/workforce-timesheet.dto";

@ApiTags("platform-workforce-timesheets")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/timesheets")
@UseGuards(PermissionsGuard)
export class WorkforceTimesheetsController {
  constructor(private readonly timesheets: WorkforceTimesheetsService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Month timesheet (get or create draft)" })
  getMonth(
    @OrganizationId() organizationId: string,
    @Query() query: ListWorkforceTimesheetQueryDto,
  ) {
    return this.timesheets.getOrCreateMonth(
      organizationId,
      query.year,
      query.month,
      {
        page: query.page,
        pageSize: query.pageSize,
        orgUnitId: query.orgUnitId,
        employmentId: query.employmentId,
      },
    );
  }

  @Get("draft")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List draft CP timesheet rows (legacy)" })
  listDraft(@OrganizationId() organizationId: string) {
    return this.timesheets.listDraft(organizationId);
  }

  @Post("approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({
    summary:
      "Deprecated: cherry-pick approve (410 — use POST :id/approve for the month)",
    deprecated: true,
  })
  approveEntries(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: ApproveTimesheetEntriesDto,
  ) {
    return this.timesheets.approveBatch(
      organizationId,
      user.sub,
      body.entryIds ?? [],
    );
  }

  @Post(":id/autofill")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Fill WORK on weekdays, OFF on Sat/Sun (chunked)" })
  autofill(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.timesheets.autofill(organizationId, id, user.sub);
  }

  @Post(":id/sync-absences")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Lock cells from approved absences" })
  syncAbsences(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.timesheets.syncAbsences(organizationId, id, user.sub);
  }

  @Post(":id/materialize-roster")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_TIMESHEET)
  @ApiOperation({
    summary:
      "Retired. The shift plan is not copied into timesheet cells. Fact stays manual, FaceID, or an approved absence.",
  })
  materializeRoster() {
    throw new GoneException({
      code: "ROSTER_MATERIALIZE_RETIRED",
      message:
        "Shift plan is not written into the timesheet. Compare plan and fact on the variance screen.",
    });
  }

  @Patch(":id/entries/batch")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Batch update day range for an employment" })
  batch(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: WorkforceTimesheetBatchUpdateDto,
  ) {
    return this.timesheets.batchUpdate(
      organizationId,
      id,
      dto.batches,
      user.sub,
    );
  }

  @Post(":id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Approve the month timesheet and emit payroll event" })
  approveMonth(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.timesheets.approveMonth(organizationId, id, user.sub);
  }
}
