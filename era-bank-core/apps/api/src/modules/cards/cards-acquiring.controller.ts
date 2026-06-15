import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { CardsService } from "./cards.service";

class AcquiringAuthDto {
  @IsString()
  cardToken!: string;

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

class AcquiringCaptureDto {
  @IsString()
  processorRef!: string;

  @IsOptional()
  @IsString()
  amountMinor?: string;
}

@ApiTags("cards-acquiring")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_cards")
@Controller("cards/acquiring/inbound")
export class CardsAcquiringController {
  constructor(private readonly cards: CardsService) {}

  @Post("authorize")
  authorize(@Body() dto: AcquiringAuthDto) {
    return this.cards.acquiringAuthorize({
      cardToken: dto.cardToken,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      processorRef: dto.processorRef,
      merchantName: dto.merchantName,
      mcc: dto.mcc,
    });
  }

  @Post("capture")
  capture(@Body() dto: AcquiringCaptureDto) {
    return this.cards.acquiringCapture({
      processorRef: dto.processorRef,
      amountMinor: dto.amountMinor ? BigInt(dto.amountMinor) : undefined,
    });
  }
}
