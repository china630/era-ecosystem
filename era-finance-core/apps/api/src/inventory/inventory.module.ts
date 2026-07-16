import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { AccessControlModule } from "../access/access-control.module";
import { ContractsModule } from "../contracts/contracts.module";
import { GovBudgetModule } from "../gov-budget/gov-budget.module";
import { FxModule } from "../fx/fx.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { BinBalanceService } from "./bin-balance.service";
import { InventoryAuditController } from "./inventory-audit.controller";
import { InventoryAuditService } from "./inventory-audit.service";
import { InventoryReconciliationController } from "./inventory-reconciliation.controller";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { WmsController } from "./wms.controller";
import { WmsMobileService } from "./wms-mobile.service";

@Module({
  imports: [PrismaModule, AccountingModule, StockModule, AccessControlModule, ContractsModule, GovBudgetModule, FxModule],
  controllers: [
    InventoryController,
    InventoryAuditController,
    InventoryReconciliationController,
    WmsController,
  ],
  providers: [InventoryService, InventoryAuditService, BinBalanceService, WmsMobileService],
  exports: [InventoryService, BinBalanceService, WmsMobileService],
})
export class InventoryModule {}
