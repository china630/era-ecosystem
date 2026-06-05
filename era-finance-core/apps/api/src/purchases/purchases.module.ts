import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PurchasesController } from "./purchases.controller";
import { PurchasePaymentService } from "./purchase-payment.service";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [PurchasesController],
  providers: [PurchasePaymentService],
  exports: [PurchasePaymentService],
})
export class PurchasesModule {}
