import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentOrderStatus, PaymentRail } from "@era/bank-core-database";
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

class RejectPaymentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags("payments")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("orders")
  list(@Query("status") status?: PaymentOrderStatus) {
    return this.payments.listOrders(status);
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

  @Post("orders/:id/approve")
  approve(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.payments.approveOrder(id, req.userId ?? "service");
  }

  @Post("orders/:id/reject")
  reject(
    @Param("id") id: string,
    @Body() dto: RejectPaymentDto,
    @Req() req: BankAuthRequest,
  ) {
    return this.payments.rejectOrder(id, req.userId ?? "service", dto.reason);
  }

  @Post("inbound")
  inbound(@Body() dto: InboundPaymentDto) {
    return this.payments.inbound({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }
}
