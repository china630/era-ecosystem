import { CP_PERMISSION } from "@era/contracts";
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { ApplySchemePeriodDto } from "./dto/scheme-period.dto";
import { SchemePeriodService } from "./scheme-period.service";

@ApiTags("reporting")
@ApiBearerAuth("bearer")
@Controller("reporting/scheme-period")
@UseGuards(PermissionsGuard)
export class SchemePeriodController {
  constructor(private readonly periods: SchemePeriodService) {}

  @Get("amendments")
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Amendment drafts for a filed declaration. Sending them is a manual mark." })
  list(
    @OrganizationId() organizationId: string,
    @Query("period") period?: string,
  ) {
    return this.periods.list(organizationId, period?.trim() || undefined);
  }

  @Post("apply")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Recalculate simplified tax from the scheme and the saved export amount",
  })
  apply(
    @OrganizationId() organizationId: string,
    @Body() dto: ApplySchemePeriodDto,
  ) {
    return this.periods.apply(organizationId, dto);
  }

  @Post("amendments/:id/sent")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Mark an amendment draft sent. Does not call the tax gateway." })
  markSent(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.periods.markSent(organizationId, id);
  }
}
