import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { PayPurchaseDto } from "./dto/pay-purchase.dto";
import { PurchasePaymentService } from "./purchase-payment.service";

@ApiTags("purchases")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(PermissionsGuard)
export class PurchasesController {
  constructor(private readonly payments: PurchasePaymentService) {}

  @Post("purchases/invoices/:id/pay")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Pay purchase invoice (Dr 531 / Cr cash or bank)" })
  payInvoice(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: PayPurchaseDto,
  ) {
    return this.payments.payPurchaseInvoice(organizationId, id, dto);
  }

  @Get("payables/suppliers")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Supplier payables (531) by counterparty" })
  listSupplierPayables(@OrganizationId() organizationId: string) {
    return this.payments.listSupplierPayables(organizationId);
  }

  @Post("payables/suppliers/:counterpartyId/pay")
  @Permissions(CP_PERMISSION.API_PURCHASES_MANAGE)
  @ApiOperation({ summary: "Pay supplier payable (531) for counterparty" })
  paySupplier(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Body() dto: PayPurchaseDto,
  ) {
    return this.payments.paySupplierFifo(organizationId, counterpartyId, dto);
  }
}
