import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { EligibilityCheckDto } from "./dto/eligibility-check.dto";

@ApiTags("insurance")
@ApiBearerAuth("bearer")
@Controller("insurance")
@UseGuards(PermissionsGuard)
export class IndustryHandoffsInsuranceController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("eligibility-check")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "v1.1 — DMS / insurance eligibility stub" })
  eligibilityCheck(
    @OrganizationId() organizationId: string,
    @Body() dto: EligibilityCheckDto,
  ) {
    return this.handoffs.eligibilityCheck(organizationId, dto);
  }
}
