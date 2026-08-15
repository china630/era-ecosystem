import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CardStatus, CardTxnStatus, CardDisputeStatus } from "@era/bank-core-database";
import { IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { CardsService } from "./cards.service";

class IssueCardDto {
  @IsString()
  customerId!: string;

  @IsString()
  accountId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  productTemplateId!: string;

  @IsOptional()
  @IsString()
  panLast4?: string;

  @IsOptional()
  @IsString()
  bin6?: string;

  @IsOptional()
  @IsNumber()
  expiryMonth?: number;

  @IsOptional()
  @IsNumber()
  expiryYear?: number;

  @IsOptional()
  @IsObject()
  limitsJson?: Record<string, unknown>;
}

class LimitsDto {
  @IsObject()
  limitsJson!: Record<string, unknown>;
}

class BlockDto {
  @IsString()
  reason!: string;
}

@ApiTags("cards")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard)
@RequireBankingModule("banking_cards")
@Controller("cards")
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(
    @Query("customerId") customerId?: string,
    @Query("accountId") accountId?: string,
    @Query("status") status?: CardStatus,
  ) {
    return this.cards.list({ customerId, accountId, status });
  }

  @Get("disputes/list")
  listDisputes(@Query("status") status?: CardDisputeStatus) {
    return this.cards.listDisputes(status);
  }

  @Post("disputes")
  createDispute(
    @Body()
    dto: {
      cardTransactionId: string;
      amountMinor: string;
      currency?: string;
      reasonCode: string;
    },
  ) {
    return this.cards.createDispute({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }

  @Patch("disputes/:id")
  patchDispute(
    @Param("id") id: string,
    @Body() dto: { status: CardDisputeStatus },
  ) {
    return this.cards.updateDisputeStatus(id, dto.status);
  }

  @Get("3ds/challenges")
  listThreeDs(@Query("cardId") cardId?: string) {
    return this.cards.listThreeDs(cardId);
  }

  @Post("3ds/challenges")
  createThreeDs(
    @Body() dto: { cardId: string; amountMinor: string; currency?: string },
  ) {
    return this.cards.createThreeDs({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }

  @Post("3ds/challenges/:id/complete")
  completeThreeDs(
    @Param("id") id: string,
    @Body() dto: { success: boolean },
  ) {
    return this.cards.completeThreeDs(id, dto.success);
  }

  @Get("merchants")
  listMerchants() {
    return this.cards.listMerchants();
  }

  @Post("merchants")
  registerMerchant(
    @Body()
    dto: { merchantCode: string; name: string; mcc?: string; authToken?: string },
  ) {
    return this.cards.registerMerchant(dto);
  }

  @Post("merchants/authorize")
  merchantAuthorize(
    @Body()
    dto: {
      merchantCode: string;
      authToken: string;
      cardToken: string;
      amountMinor: string;
      currency: string;
      processorRef: string;
    },
  ) {
    return this.cards.authorizeMerchant({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.cards.getById(id);
  }

  @Post()
  issue(@Body() dto: IssueCardDto) {
    return this.cards.issue(dto);
  }

  @Patch(":id/limits")
  limits(@Param("id") id: string, @Body() dto: LimitsDto) {
    return this.cards.updateLimits(id, dto.limitsJson);
  }

  @Post(":id/block")
  block(@Param("id") id: string, @Body() dto: BlockDto) {
    return this.cards.block(id, dto.reason);
  }

  @Post(":id/unblock")
  unblock(@Param("id") id: string) {
    return this.cards.unblock(id);
  }

  @Post(":id/close")
  close(@Param("id") id: string) {
    return this.cards.close(id);
  }
}
