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
import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";
import { DboStandingOrdersService } from "./dbo-standing-orders.service";

class CreateStandingOrderDto {
  @IsString()
  fromAccountId!: string;

  @IsString()
  toIban!: string;

  @IsNumber()
  amountMinor!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  nextRunAt!: string;

  @IsOptional()
  @IsString()
  cronExpr?: string;
}

@ApiTags("dbo-standing-orders")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/standing-orders")
export class DboStandingOrdersController {
  constructor(private readonly standingOrders: DboStandingOrdersService) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.standingOrders.list(req.customerAuth);
  }

  @Post()
  create(
    @Req() req: BankCustomerRequest,
    @Body() dto: CreateStandingOrderDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.standingOrders.create(req.customerAuth, {
      fromAccountId: dto.fromAccountId,
      toIban: dto.toIban,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      nextRunAt: new Date(dto.nextRunAt),
      cronExpr: dto.cronExpr,
      idempotencyKey: idempotencyKey ?? `so-${Date.now()}`,
    });
  }

  @Post(":id/pause")
  pause(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.standingOrders.pause(req.customerAuth, id);
  }
}
