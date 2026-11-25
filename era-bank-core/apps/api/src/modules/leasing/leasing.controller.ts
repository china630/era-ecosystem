import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { LeasingService } from "./leasing.service";

class CreateAssetDto {
  @IsString() description!: string;
  @IsString() catalogValueMinor!: string;
  @IsOptional() @IsString() serialRef?: string;
  @IsOptional() @IsString() currency?: string;
}

class OriginateLeaseDto {
  @IsString() customerId!: string;
  @IsString() assetId!: string;
  @IsString() productTemplateId!: string;
  @IsNumber() advancePct!: number;
  @IsString() residualValueMinor!: string;
  @IsNumber() termMonths!: number;
  @IsOptional() @IsNumber() rateAnnual?: number;
  @IsOptional() @IsBoolean() linkLoan?: boolean;
}

@ApiTags("leasing")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("leasing")
export class LeasingController {
  constructor(private readonly leasing: LeasingService) {}

  @Get("assets")
  listAssets() {
    return this.leasing.listAssets();
  }

  @Post("assets")
  createAsset(@Body() body: CreateAssetDto) {
    return this.leasing.createAsset(body);
  }

  @Get("contracts")
  listPortfolio() {
    return this.leasing.listPortfolio();
  }

  @Post("contracts")
  originate(
    @Req() req: BankAuthRequest,
    @Body() body: OriginateLeaseDto,
  ) {
    return this.leasing.originateLease({
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Get("contracts/:id")
  get(@Param("id") id: string) {
    return this.leasing.getById(id);
  }

  @Get("contracts/:id/schedule")
  schedule(@Param("id") id: string) {
    return this.leasing.getSchedule(id);
  }

  @Get("contracts/:id/buyout-quote")
  buyout(@Param("id") id: string) {
    return this.leasing.buyoutQuote(id);
  }

  @Post("contracts/:id/accrue-finance-income")
  accrue(@Param("id") id: string) {
    return this.leasing.accrueFinanceIncome(id);
  }
}
