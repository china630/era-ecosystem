import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { PaymentsService, type CreatePaymentLinkInput } from "./payments.service";

@ApiTags("platform-payments")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/payments/v1")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("payment-links")
  @ApiOperation({ summary: "Create payment link for invoice or deposit" })
  createPaymentLink(
    @OrganizationId() organizationId: string,
    @Body() body: CreatePaymentLinkInput,
  ) {
    return this.payments.createPaymentLink(organizationId, body);
  }

  @Get("payment-links/:token")
  @ApiOperation({ summary: "Resolve payment link by public token" })
  getPaymentLink(@Param("token") token: string) {
    return this.payments.getPaymentLinkByToken(token);
  }

  @Post("authorizations")
  @ApiOperation({ summary: "Create card authorization hold (mock MVP)" })
  createAuthorization(
    @OrganizationId() organizationId: string,
    @Body() body: { reservationId: string; amountAzn: number },
  ) {
    return this.payments.createAuthorization(organizationId, body);
  }

  @Post("authorizations/:id/capture")
  @ApiOperation({ summary: "Capture authorization (mock MVP)" })
  captureAuthorization(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() body: { amountAzn?: number },
  ) {
    return this.payments.captureAuthorization(organizationId, id, body);
  }

  @Post("authorizations/:id/void")
  @ApiOperation({ summary: "Void/release authorization (mock MVP)" })
  voidAuthorization(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.payments.voidAuthorization(organizationId, id);
  }

  @Post("payment-links/:token/reconcile")
  @ApiOperation({ summary: "Reconcile payment link as PAID (Live)" })
  reconcile(
    @OrganizationId() organizationId: string,
    @Param("token") token: string,
  ) {
    return this.payments.reconcilePaymentLink(organizationId, token);
  }
}