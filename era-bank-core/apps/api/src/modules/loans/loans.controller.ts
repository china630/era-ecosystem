import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { LoansService } from "./loans.service";

class OriginateLoanDto {
  @IsString()
  customerId!: string;

  @IsString()
  productTemplateId!: string;

  @IsString()
  principalMinor!: string;

  @IsString()
  currency!: string;

  @IsNumber()
  termMonths!: number;

  @IsNumber()
  rateAnnual!: number;
}

class DisburseDto {
  @IsString()
  accountId!: string;
}

class RepayDto {
  @IsString()
  amountMinor!: string;
}

class RestructureDto {
  @IsNumber()
  ifrs9Stage!: number;
}

@ApiTags("loans")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("loans")
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list() {
    return this.loans.list();
  }

  @Post()
  originate(@Body() dto: OriginateLoanDto) {
    return this.loans.originate({
      ...dto,
      principalMinor: BigInt(dto.principalMinor),
    });
  }

  @Get(":id/schedule")
  schedule(@Param("id") id: string) {
    return this.loans.schedule(id);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.loans.getById(id);
  }

  @Post(":id/disburse")
  disburse(@Param("id") id: string, @Body() dto: DisburseDto) {
    return this.loans.disburse(id, dto.accountId);
  }

  @Post(":id/repay")
  repay(@Param("id") id: string, @Body() dto: RepayDto) {
    return this.loans.repay(id, BigInt(dto.amountMinor));
  }

  @Post(":id/restructure")
  restructure(@Param("id") id: string, @Body() dto: RestructureDto) {
    return this.loans.restructure(id, dto.ifrs9Stage);
  }
}
