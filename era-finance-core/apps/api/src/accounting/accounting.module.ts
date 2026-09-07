import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingBookController } from "./accounting-book.controller";
import { AccountingBookService } from "./accounting-book.service";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { ManualAdjustmentController } from "./manual-adjustment.controller";
import { ManualAdjustmentService } from "./manual-adjustment.service";
import { BankSubaccountService } from "./bank-subaccount.service";
import { IfrsAutoMappingService } from "./ifrs-auto-mapping.service";
import { LedgerMappingController } from "./ledger-mapping.controller";
import { LedgerMappingService } from "./ledger-mapping.service";
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
    AccountingBookController,
    ManualAdjustmentController,
    PostingRolesController,
    GrantReceiptController,
    SubcontoController,
    VatDepositController,
    LedgerMappingController,
  ],
  providers: [
    AccountingService,
    AccountingBookService,
    ManualAdjustmentService,
    BankSubaccountService,
    IfrsAutoMappingService,
    LedgerMappingService,
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
    AccountingBookService,
    ManualAdjustmentService,
    BankSubaccountService,
    NettingService,
    PostingAccountResolver,
    PostingJournalBuilder,
    GrantReceiptService,
    SubcontoService,
    VatDepositService,
    LedgerMappingService,
    IfrsAutoMappingService,
  ],
})
export class AccountingModule {}
