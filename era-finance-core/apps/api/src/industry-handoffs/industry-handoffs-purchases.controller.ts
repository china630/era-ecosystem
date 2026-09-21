import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { IndustryHandoffsService } from "./industry-handoffs.service";
import { SupplierMatchDto } from "./dto/supplier-match.dto";
import { ExternalPurchaseDto } from "./dto/external-purchase.dto";

@ApiTags("purchases")
@ApiBearerAuth("bearer")
@Controller("purchases")
@UseGuards(PermissionsGuard)
export class IndustryHandoffsPurchasesController {
  constructor(private readonly handoffs: IndustryHandoffsService) {}

  @Post("supplier-match")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "v1.1 — supplier invoice match" })
  supplierMatch(@OrganizationId() organizationId: string, @Body() dto: SupplierMatchDto) {
    return this.handoffs.supplierMatch(organizationId, dto);
  }

  @Post("from-external")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "v1.1 — external B2B purchase order (auto-sto)" })
  fromExternal(@OrganizationId() organizationId: string, @Body() dto: ExternalPurchaseDto) {
    return this.handoffs.externalPurchase(organizationId, dto);
  }
}
