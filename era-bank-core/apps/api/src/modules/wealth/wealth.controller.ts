import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { WealthService } from "./wealth.service";

class CreateSafeDto {
  @IsString() customerId!: string;
  @IsString() accountNo!: string;
  @IsOptional() @IsString() csdAccountNo?: string;
  @IsOptional() @IsString() currency?: string;
}
class ReceiveDto {
  @IsString() safekeepingAccountId!: string;
  @IsString() isin!: string;
  @IsString() quantity!: string;
}
class CommDto {
  @IsString() customerId!: string;
  @IsString() policyRef!: string;
  @IsString() amountMinor!: string;
}
class CsdDto {
  @IsString() customerId!: string;
  @IsString() csdAccountNo!: string;
}
class BrokerageDto {
  @IsString() customerId!: string;
  @IsString() isin!: string;
  @IsString() side!: string;
  @IsString() quantity!: string;
  @IsOptional() @IsString() limitPriceMinor?: string;
}
class MetalDto {
  @IsString() customerId!: string;
  @IsString() metalCode!: string;
  @IsString() weightGrams!: string;
}

@ApiTags("wealth")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_wealth")
@Controller("wealth")
export class WealthController {
  constructor(private readonly wealth: WealthService) {}

  @Get("safekeeping")
  list() {
    return this.wealth.listSafekeeping();
  }

  @Post("safekeeping")
  create(@Body() body: CreateSafeDto) {
    return this.wealth.createSafekeeping(body);
  }

  @Post("positions/receive")
  receive(@Body() body: ReceiveDto) {
    return this.wealth.receiveFop(body);
  }

  @Post("insurance-commissions")
  commission(@Body() body: CommDto) {
    return this.wealth.createInsuranceCommission(body);
  }

  @Get("insurance/products")
  listInsuranceProducts() {
    return this.wealth.listInsuranceProducts();
  }

  @Post("insurance/products")
  createInsuranceProduct(
    @Body()
    body: {
      code: string;
      name: string;
      partnerName: string;
      commissionBps?: number;
    },
  ) {
    return this.wealth.createInsuranceProduct(body);
  }

  @Post("insurance/policies")
  linkPolicy(
    @Body()
    body: {
      customerId: string;
      insuranceProductId: string;
      policyRef: string;
      premiumMinor: string;
      currency?: string;
    },
  ) {
    return this.wealth.linkInsurancePolicy(body);
  }

  @Get("csd-accounts")
  listCsd() {
    return this.wealth.listCsdAccounts();
  }

  @Post("csd-accounts")
  createCsd(@Body() body: CsdDto) {
    return this.wealth.createCsdAccount(body);
  }

  @Get("brokerage-orders")
  listBrokerage() {
    return this.wealth.listBrokerageOrders();
  }

  @Post("brokerage-orders")
  createBrokerage(@Body() body: BrokerageDto) {
    return this.wealth.createBrokerageOrder(body);
  }

  @Get("metal-positions")
  listMetal() {
    return this.wealth.listMetalPositions();
  }

  @Post("metal-positions")
  createMetal(@Body() body: MetalDto) {
    return this.wealth.createMetalPosition(body);
  }
}
