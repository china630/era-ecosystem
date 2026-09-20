import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Controller, Get, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { ActiveListService } from "./active-list.service";

@ApiTags("hr-reports")
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller("hr/reports")
export class ActiveListController {
  constructor(private readonly activeList: ActiveListService) {}

  @Get("active-list")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({
    summary:
      "Aktiv list: ACTIVE employees + MDM ops-profile (read-through) + latest posted slip",
  })
  list(@OrganizationId() organizationId: string) {
    return this.activeList.buildActiveList(organizationId);
  }

  @Get("active-list.xlsx")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
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
