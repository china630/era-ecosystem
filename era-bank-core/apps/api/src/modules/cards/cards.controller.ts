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
import { CardStatus, CardTxnStatus } from "@era/bank-core-database";
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
  panLast4!: string;

  @IsString()
  bin6!: string;

  @IsNumber()
  expiryMonth!: number;

  @IsNumber()
  expiryYear!: number;

  @IsObject()
  limitsJson!: Record<string, unknown>;
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
