import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AccessControlModule } from "../access/access-control.module";
import { ContractsModule } from "../contracts/contracts.module";
import { GovBudgetModule } from "../gov-budget/gov-budget.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { InventoryAuditController } from "./inventory-audit.controller";
import { InventoryAuditService } from "./inventory-audit.service";
import { InventoryReconciliationController } from "./inventory-reconciliation.controller";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [PrismaModule, AccountingModule, StockModule, AccessControlModule, ContractsModule, GovBudgetModule],
  controllers: [
    InventoryController,
    InventoryAuditController,
    InventoryReconciliationController,
  ],
  providers: [InventoryService, InventoryAuditService],
  exports: [InventoryService],
})
export class InventoryModule {}
