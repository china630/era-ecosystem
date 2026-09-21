import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { RateQuoteDto } from "./dto/rate-quote.dto";
import { CodClearingDto } from "./dto/cod-clearing.dto";

@ApiTags("logistics")
@ApiBearerAuth("bearer")
@Controller("logistics")
@UseGuards(PermissionsGuard)
export class IndustryHandoffsLogisticsController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("rate-quote")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "v1.1 — tariff rate quote" })
  rateQuote(@OrganizationId() organizationId: string, @Body() dto: RateQuoteDto) {
    return this.handoffs.rateQuote(organizationId, dto);
  }

  @Post("cod-clearing")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "v1.1 — COD split and clearing" })
  codClearing(@OrganizationId() organizationId: string, @Body() dto: CodClearingDto) {
    return this.handoffs.codClearing(organizationId, dto);
  }

  @Get("fx-preview")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "Operational CBAR FX preview (via data-hub)" })
  fxPreview(
    @Query("from") from: string,
    @Query("amount") amount: string,
    @Query("to") to?: string,
    @Query("date") date?: string,
  ) {
    return this.handoffs.fxPreview({
      from,
      to,
      amount: Number(amount),
      date,
    });
  }

  @Get("hs-preview")
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({ summary: "HS tariff preview (via data-hub)" })
  hsPreview(
    @Query("code") code: string,
    @Query("date") date?: string,
  ) {
    return this.handoffs.hsPreview({ hsCode: code, date });
  }
}
