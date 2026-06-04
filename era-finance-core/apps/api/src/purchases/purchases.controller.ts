import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { PayPurchaseDto } from "./dto/pay-purchase.dto";
import { PurchasePaymentService } from "./purchase-payment.service";

@ApiTags("purchases")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(RolesGuard)
export class PurchasesController {
  constructor(private readonly payments: PurchasePaymentService) {}

  @Post("purchases/invoices/:id/pay")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Pay purchase invoice (Dr 531 / Cr cash or bank)" })
  payInvoice(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: PayPurchaseDto,
  ) {
    return this.payments.payPurchaseInvoice(organizationId, id, dto);
  }

  @Get("payables/suppliers")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DIRECTOR)
  @ApiOperation({ summary: "Supplier payables (531) by counterparty" })
  listSupplierPayables(@OrganizationId() organizationId: string) {
    return this.payments.listSupplierPayables(organizationId);
  }

  @Post("payables/suppliers/:counterpartyId/pay")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Pay supplier payable (531) for counterparty" })
  paySupplier(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Body() dto: PayPurchaseDto,
  ) {
    return this.payments.paySupplierFifo(organizationId, counterpartyId, dto);
  }
}
