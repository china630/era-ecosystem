import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { DepositsService } from "./deposits.service";

class OpenDepositDto {
  @IsString()
  accountId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  productTemplateId!: string;

  @IsString()
  principalMinor!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;
}

class RolloverDto {
  @IsDateString()
  newMaturityDate!: string;
}

@ApiTags("deposits")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("deposits")
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Get()
  list() {
    return this.deposits.list();
  }

  @Post()
  open(@Body() dto: OpenDepositDto) {
    return this.deposits.open({
      ...dto,
      principalMinor: BigInt(dto.principalMinor),
      maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.deposits.getById(id);
  }

  @Post(":id/close")
  close(@Param("id") id: string) {
    return this.deposits.close(id);
  }

  @Post(":id/rollover")
  rollover(@Param("id") id: string, @Body() dto: RolloverDto) {
    return this.deposits.rollover(id, new Date(dto.newMaturityDate));
  }
}
