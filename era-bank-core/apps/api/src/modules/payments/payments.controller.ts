import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentRail } from "@era/bank-core-database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { PaymentsService } from "./payments.service";

class CreatePaymentOrderDto {
  @IsOptional()
  @IsString()
  debtorAccountId?: string;

  @IsString()
  creditorIban!: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  currency!: string;

  @IsEnum(PaymentRail)
  rail!: PaymentRail;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  narrative?: string;
}

class InboundPaymentDto {
  @IsString()
  idempotencyKey!: string;

  @IsString()
  creditorIban!: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  currency!: string;
}

@ApiTags("payments")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("orders")
  list() {
    return this.payments.listOrders();
  }

  @Post("orders")
  create(@Body() dto: CreatePaymentOrderDto, @Req() req: BankAuthRequest) {
    return this.payments.createOrder({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
      createdByUserId: req.userId ?? "service",
    });
  }

  @Get("orders/:id")
  get(@Param("id") id: string) {
    return this.payments.getOrder(id);
  }

  @Post("orders/:id/submit")
  submit(@Param("id") id: string) {
    return this.payments.submitOrder(id);
  }

  @Post("inbound")
  inbound(@Body() dto: InboundPaymentDto) {
    return this.payments.inbound({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }
}
