import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { IntangibleAmortizationService } from "./intangible-amortization.service";
import { IntangibleAssetsController } from "./intangible-assets.controller";
import { IntangibleAssetsService } from "./intangible-assets.service";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [IntangibleAssetsController],
  providers: [IntangibleAssetsService, IntangibleAmortizationService],
  exports: [IntangibleAmortizationService],
})
export class IntangibleAssetsModule {}
