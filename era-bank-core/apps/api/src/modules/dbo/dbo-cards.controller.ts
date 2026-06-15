import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";
import { CardsService } from "../cards/cards.service";

@ApiTags("dbo-cards")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/cards")
export class DboCardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.cards.list({ customerId: req.customerAuth.sub });
  }

  @Get(":id")
  detail(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.cards.getById(id).then((card) => {
      if (!card || card.customerId !== req.customerAuth.sub) return null;
      return card;
    });
  }

  @Post(":id/temporary-block")
  temporaryBlock(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    return this.cards.getById(id).then(async (card) => {
      if (!card || card.customerId !== req.customerAuth.sub) return null;
      return this.cards.block(id, "Customer temporary block via DBO");
    });
  }
}
