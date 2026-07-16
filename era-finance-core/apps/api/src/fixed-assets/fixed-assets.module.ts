import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { DepreciationService } from "./depreciation.service";
import { FixedAssetLifecycleService } from "./fixed-asset-lifecycle.service";
import { FixedAssetsController } from "./fixed-assets.controller";
import { FixedAssetsService } from "./fixed-assets.service";
import { MonthlyDepreciationQueueService } from "./monthly-depreciation.queue";
import { MonthlyDepreciationWorker } from "./monthly-depreciation.worker";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [FixedAssetsController],
  providers: [
    FixedAssetsService,
    FixedAssetLifecycleService,
    DepreciationService,
    MonthlyDepreciationQueueService,
    MonthlyDepreciationWorker,
    RolesGuard,
  ],
  exports: [DepreciationService, FixedAssetLifecycleService],
})
export class FixedAssetsModule {}
