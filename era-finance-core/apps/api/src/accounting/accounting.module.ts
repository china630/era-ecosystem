import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { ManualAdjustmentController } from "./manual-adjustment.controller";
import { ManualAdjustmentService } from "./manual-adjustment.service";
import { BankSubaccountService } from "./bank-subaccount.service";
import { IfrsAutoMappingService } from "./ifrs-auto-mapping.service";
import { NettingService } from "./netting.service";
import { PostingAccountResolver } from "./posting/posting-account-resolver.service";
import { PostingJournalBuilder } from "./posting/posting-journal-builder.service";
import { GrantReceiptController } from "./posting/grant-receipt.controller";
import { GrantReceiptService } from "./posting/grant-receipt.service";
import { PostingRolesController } from "./posting/posting-roles.controller";
import { PostingRolesService } from "./posting/posting-roles.service";
import { SubcontoController } from "./subconto.controller";
import { SubcontoService } from "./subconto.service";
import { VatDepositController } from "./vat-deposit.controller";
import { VatDepositService } from "./vat-deposit.service";

@Module({
  imports: [],
  controllers: [
    AccountingController,
    ManualAdjustmentController,
    PostingRolesController,
    GrantReceiptController,
    SubcontoController,
    VatDepositController,
  ],
  providers: [
    AccountingService,
    ManualAdjustmentService,
    BankSubaccountService,
    IfrsAutoMappingService,
    NettingService,
    PostingAccountResolver,
    PostingJournalBuilder,
    PostingRolesService,
    GrantReceiptService,
    SubcontoService,
    VatDepositService,
    RolesGuard,
  ],
  exports: [
    AccountingService,
    ManualAdjustmentService,
    BankSubaccountService,
    NettingService,
    PostingAccountResolver,
    PostingJournalBuilder,
    GrantReceiptService,
    SubcontoService,
    VatDepositService,
  ],
})
export class AccountingModule {}
