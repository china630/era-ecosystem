import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { EligibilityCheckDto } from "./dto/eligibility-check.dto";

@ApiTags("insurance")
@ApiBearerAuth("bearer")
@Controller("insurance")
@UseGuards(RolesGuard)
export class IndustryHandoffsInsuranceController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("eligibility-check")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  @ApiOperation({ summary: "v1.1 — DMS / insurance eligibility stub" })
  eligibilityCheck(
    @OrganizationId() organizationId: string,
    @Body() dto: EligibilityCheckDto,
  ) {
    return this.handoffs.eligibilityCheck(organizationId, dto);
  }
}
