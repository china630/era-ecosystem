import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { StockCheckDto } from "./dto/stock-check.dto";

@ApiTags("inventory")
@ApiBearerAuth("bearer")
@Controller("inventory")
@UseGuards(PermissionsGuard)
export class IndustryHandoffsInventoryController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("stock-check")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "v1.1 — shelf / mobile stock check (WMS lite)" })
  stockCheck(@OrganizationId() organizationId: string, @Body() dto: StockCheckDto) {
    return this.handoffs.stockCheck(organizationId, dto);
  }

  @Get("replenishment-suggestions")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "v1.1 — auto-replenishment suggestions" })
  replenishmentSuggestions(@OrganizationId() organizationId: string) {
    return this.handoffs.replenishmentSuggestions(organizationId);
  }
}
