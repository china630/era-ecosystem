import { Module } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { BankSubaccountService } from "./bank-subaccount.service";
import { IfrsAutoMappingService } from "./ifrs-auto-mapping.service";
import { NettingService } from "./netting.service";
import { PostingAccountResolver } from "./posting/posting-account-resolver.service";
import { PostingJournalBuilder } from "./posting/posting-journal-builder.service";
import { GrantReceiptController } from "./posting/grant-receipt.controller";
import { GrantReceiptService } from "./posting/grant-receipt.service";
import { PostingRolesController } from "./posting/posting-roles.controller";
import { PostingRolesService } from "./posting/posting-roles.service";

@Module({
  controllers: [
    AccountingController,
    PostingRolesController,
    GrantReceiptController,
  ],
  providers: [
    AccountingService,
    BankSubaccountService,
    IfrsAutoMappingService,
    NettingService,
    PostingAccountResolver,
    PostingJournalBuilder,
    PostingRolesService,
    GrantReceiptService,
    RolesGuard,
  ],
  exports: [
    AccountingService,
    BankSubaccountService,
    NettingService,
    PostingAccountResolver,
    PostingJournalBuilder,
    GrantReceiptService,
  ],
})
export class AccountingModule {}
