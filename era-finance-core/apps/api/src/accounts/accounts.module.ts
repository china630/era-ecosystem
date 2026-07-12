import { Module, forwardRef } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AccountMappingsController } from "./account-mappings.controller";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { IfrsMappingRulesController } from "./ifrs-mapping-rules.controller";

@Module({
  imports: [PrismaModule, forwardRef(() => AccountingModule)],
  controllers: [
    AccountsController,
    AccountMappingsController,
    IfrsMappingRulesController,
  ],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
