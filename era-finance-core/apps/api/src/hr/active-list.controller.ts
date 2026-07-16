import { Controller, Get, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { OrganizationId } from "../common/org-id.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActiveListService } from "./active-list.service";

@ApiTags("hr-reports")
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller("hr/reports")
export class ActiveListController {
  constructor(private readonly activeList: ActiveListService) {}

  @Get("active-list")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.HR_MANAGER)
  @ApiOperation({
    summary:
      "Aktiv list: ACTIVE employees + MDM HR profile (read-through) + latest posted slip",
  })
  list(@OrganizationId() organizationId: string) {
    return this.activeList.buildActiveList(organizationId);
  }

  @Get("active-list.xlsx")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Aktiv list Excel export (ExcelJS)" })
  async xlsx(
    @OrganizationId() organizationId: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } =
      await this.activeList.buildActiveListXlsx(organizationId);
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
