import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { StockCheckDto } from "./dto/stock-check.dto";

@ApiTags("inventory")
@ApiBearerAuth("bearer")
@Controller("inventory")
@UseGuards(RolesGuard)
export class IndustryHandoffsInventoryController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("stock-check")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  @ApiOperation({ summary: "v1.1 — shelf / mobile stock check (WMS lite)" })
  stockCheck(@OrganizationId() organizationId: string, @Body() dto: StockCheckDto) {
    return this.handoffs.stockCheck(organizationId, dto);
  }

  @Get("replenishment-suggestions")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.USER)
  @ApiOperation({ summary: "v1.1 — auto-replenishment suggestions" })
  replenishmentSuggestions(@OrganizationId() organizationId: string) {
    return this.handoffs.replenishmentSuggestions(organizationId);
  }
}
