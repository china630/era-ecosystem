import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { CardsService } from "../cards/cards.service";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";

class CompleteThreeDsDto {
  @IsOptional()
  @IsBoolean()
  success?: boolean;
}

@ApiTags("dbo-3ds")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/cards/3ds/challenges")
export class DboThreeDsController {
  constructor(
    private readonly cards: CardsService,
  ) {}

  @Get()
  async list(
    @Req() req: BankCustomerRequest,
    @Query("cardId") cardId?: string,
  ) {
    if (cardId) {
      const card = await this.cards.getById(cardId);
      if (!card || card.customerId !== req.customerAuth.sub) {
        throw new ForbiddenException("Card not in customer scope");
      }
      return this.cards.listThreeDs(cardId);
    }

    const ownedCards = await this.cards.listCardIdsForCustomer(req.customerAuth.sub);
    const ids = ownedCards.map((c) => c.id);
    if (ids.length === 0) return [];
    return this.cards.listThreeDsForCards(ids);
  }

  @Post(":id/complete")
  async complete(
    @Req() req: BankCustomerRequest,
    @Param("id") id: string,
    @Body() dto: CompleteThreeDsDto,
  ) {
    const challenge = await this.cards.findThreeDs(id);
    if (!challenge) throw new NotFoundException("3DS challenge not found");
    const card = await this.cards.getById(challenge.cardId);
    if (!card || card.customerId !== req.customerAuth.sub) {
      throw new ForbiddenException("Card not in customer scope");
    }
    await this.cards.completeThreeDs(id, dto.success !== false);
    return this.cards.findThreeDsById(id);
  }
}
