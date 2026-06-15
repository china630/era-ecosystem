import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CardTxnStatus } from "@era/bank-core-database";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { CardsService } from "./cards.service";

class AuthorizeDto {
  @IsOptional()
  @IsString()
  cardId?: string;

  @IsOptional()
  @IsString()
  cardToken?: string;

  @IsString()
  amountMinor!: string;

  @IsString()
  currency!: string;

  @IsString()
  processorRef!: string;

  @IsOptional()
  @IsString()
  merchantName?: string;

  @IsOptional()
  @IsString()
  mcc?: string;
}

class CaptureDto {
  @IsOptional()
  @IsString()
  authTxnId?: string;

  @IsOptional()
  @IsString()
  processorRef?: string;

  @IsOptional()
  @IsString()
  amountMinor?: string;
}

@ApiTags("card-txns")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_cards")
@Controller("card-txns")
export class CardTxnsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Query("cardId") cardId?: string, @Query("status") status?: CardTxnStatus) {
    return this.cards.listTransactions({ cardId, status });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.cards.getTransaction(id);
  }

  @Post("authorize")
  authorize(@Body() dto: AuthorizeDto) {
    return this.cards.authorize({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }

  @Post(":id/capture")
  captureById(@Param("id") id: string, @Body() dto: CaptureDto) {
    return this.cards.capture({
      authTxnId: id,
      amountMinor: dto.amountMinor ? BigInt(dto.amountMinor) : undefined,
    });
  }

  @Post("capture")
  capture(@Body() dto: CaptureDto) {
    return this.cards.capture({
      authTxnId: dto.authTxnId,
      processorRef: dto.processorRef,
      amountMinor: dto.amountMinor ? BigInt(dto.amountMinor) : undefined,
    });
  }

  @Post(":id/reverse")
  reverse(@Param("id") id: string) {
    return this.cards.reverse(id);
  }
}
