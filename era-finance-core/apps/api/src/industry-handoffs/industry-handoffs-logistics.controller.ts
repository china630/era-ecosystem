import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { RateQuoteDto } from "./dto/rate-quote.dto";
import { CodClearingDto } from "./dto/cod-clearing.dto";

@ApiTags("logistics")
@ApiBearerAuth("bearer")
@Controller("logistics")
@UseGuards(RolesGuard)
export class IndustryHandoffsLogisticsController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("rate-quote")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  @ApiOperation({ summary: "v1.1 — tariff rate quote" })
  rateQuote(@OrganizationId() organizationId: string, @Body() dto: RateQuoteDto) {
    return this.handoffs.rateQuote(organizationId, dto);
  }

  @Post("cod-clearing")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "v1.1 — COD split and clearing" })
  codClearing(@OrganizationId() organizationId: string, @Body() dto: CodClearingDto) {
    return this.handoffs.codClearing(organizationId, dto);
  }
}
