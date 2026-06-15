import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";
import { DboPaymentsService } from "./dbo-payments.service";

class CreatePaymentDto {
  @IsString()
  debitAccountId!: string;

  @IsString()
  beneficiaryIban!: string;

  @IsString()
  beneficiaryName!: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsNumber()
  amountMinor!: number;
}

class SignPaymentDto {
  @IsOptional()
  @IsString()
  asanTransactionId?: string;
}

@ApiTags("dbo-payments")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/payments/orders")
export class DboPaymentsController {
  constructor(private readonly payments: DboPaymentsService) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.payments.listOrders(req.customerAuth);
  }

  @Post()
  create(
    @Req() req: BankCustomerRequest,
    @Body() dto: CreatePaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payments.createOrder(req.customerAuth, {
      debitAccountId: dto.debitAccountId,
      beneficiaryIban: dto.beneficiaryIban,
      beneficiaryName: dto.beneficiaryName,
      purpose: dto.purpose,
      amountMinor: BigInt(dto.amountMinor),
      idempotencyKey: idempotencyKey ?? `pay-${Date.now()}`,
    });
  }

  @Get(":id")
  detail(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.payments.getOrder(req.customerAuth, id);
  }

  @Post(":id/sign")
  sign(
    @Req() req: BankCustomerRequest,
    @Param("id") id: string,
    @Body() dto: SignPaymentDto,
  ) {
    return this.payments.signOrder(req.customerAuth, id, dto.asanTransactionId);
  }

  @Post(":id/submit")
  submit(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.payments.submitOrder(req.customerAuth, id);
  }

  @Post(":id/preflight")
  preflight(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.payments.preflightScreen(req.customerAuth, id);
  }
}
