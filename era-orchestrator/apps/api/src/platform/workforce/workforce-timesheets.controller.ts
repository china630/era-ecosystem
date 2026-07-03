import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { RolesGuard } from "../../common/guards/roles.guard";
import { WorkforceTimesheetsService } from "./workforce-timesheets.service";

@ApiTags("platform-workforce-timesheets")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/timesheets")
@UseGuards(RolesGuard)
export class WorkforceTimesheetsController {
  constructor(private readonly timesheets: WorkforceTimesheetsService) {}

  @Get("draft")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "List draft CP timesheet rows" })
  listDraft(@OrganizationId() organizationId: string) {
    return this.timesheets.listDraft(organizationId);
  }

  @Post("approve")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "Approve draft timesheet rows and emit payroll event" })
  approve(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: { entryIds: string[] },
  ) {
    return this.timesheets.approveBatch(
      organizationId,
      user.sub,
      body.entryIds ?? [],
    );
  }
}
