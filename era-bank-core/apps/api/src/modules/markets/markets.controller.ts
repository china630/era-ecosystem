import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import {
  BankingModuleGuard,
  RequireBankingModule,
} from "../../auth/banking-module.guard";
import { MarketsService } from "./markets.service";

class DerivativeDto {
  @IsString() contractRef!: string;
  @IsString() productType!: string;
  @IsString() notionalMinor!: string;
  @IsOptional() @IsString() currency?: string;
}

class BondDto {
  @IsString() isin!: string;
  @IsString() faceValueMinor!: string;
  @IsOptional() @IsString() currency?: string;
}

@ApiTags("markets")
@ApiBearerAuth()
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_markets")
@Controller("markets")
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get("derivatives")
  listDerivatives() {
    return this.markets.listDerivatives();
  }

  @Post("derivatives")
  createDerivative(@Body() body: DerivativeDto) {
    return this.markets.createDerivative(body);
  }

  @Post("derivatives/:id/book")
  bookDerivative(@Param("id") id: string) {
    return this.markets.bookDerivative(id);
  }

  @Post("derivatives/:id/cancel")
  cancelDerivative(@Param("id") id: string) {
    return this.markets.cancelDerivative(id);
  }

  @Get("bonds")
  listBonds() {
    return this.markets.listBonds();
  }

  @Post("bonds")
  createBond(@Body() body: BondDto) {
    return this.markets.createBond(body);
  }

  @Post("bonds/:id/book")
  bookBond(@Param("id") id: string) {
    return this.markets.bookBond(id);
  }

  @Post("bonds/:id/cancel")
  cancelBond(@Param("id") id: string) {
    return this.markets.cancelBond(id);
  }
}
