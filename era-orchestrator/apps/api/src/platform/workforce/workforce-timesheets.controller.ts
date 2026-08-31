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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { RolesGuard } from "../../common/guards/roles.guard";
import { WorkforceTimesheetsService } from "./workforce-timesheets.service";
import {
  ApproveTimesheetEntriesDto,
  ListWorkforceTimesheetQueryDto,
  WorkforceTimesheetBatchUpdateDto,
} from "./dto/workforce-timesheet.dto";

@ApiTags("platform-workforce-timesheets")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/timesheets")
@UseGuards(RolesGuard)
export class WorkforceTimesheetsController {
  constructor(private readonly timesheets: WorkforceTimesheetsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Month timesheet (get or create draft)" })
  getMonth(
    @OrganizationId() organizationId: string,
    @Query() query: ListWorkforceTimesheetQueryDto,
  ) {
    return this.timesheets.getOrCreateMonth(
      organizationId,
      query.year,
      query.month,
    );
  }

  @Get("draft")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "List draft CP timesheet rows (legacy)" })
  listDraft(@OrganizationId() organizationId: string) {
    return this.timesheets.listDraft(organizationId);
  }

  @Post("approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
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
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Fill WORK on weekdays, OFF on Sat/Sun" })
  autofill(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.timesheets.autofill(organizationId, id);
  }

  @Post(":id/sync-absences")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Lock cells from approved absences" })
  syncAbsences(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.timesheets.syncAbsences(organizationId, id);
  }

  @Patch(":id/entries/batch")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Batch update day range for an employment" })
  batch(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: WorkforceTimesheetBatchUpdateDto,
  ) {
    return this.timesheets.batchUpdate(organizationId, id, dto.batches);
  }

  @Post(":id/approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Approve the month timesheet and emit payroll event" })
  approveMonth(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.timesheets.approveMonth(organizationId, id, user.sub);
  }
}
