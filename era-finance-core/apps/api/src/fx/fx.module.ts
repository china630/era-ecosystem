import { Module, forwardRef } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { DataHubModule } from "../data-hub/data-hub.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { CbarRateSyncService } from "./cbar-rate-sync.service";
import { FxController } from "./fx.controller";
import { FxRevaluationCron } from "./fx-revaluation.cron";
import { FxRevaluationService } from "./fx-revaluation.service";
import { CurrencyConverterService } from "./currency-converter.service";

@Module({
  imports: [
    PrismaModule,
    DataHubModule,
    forwardRef(() => AccountingModule),
    SystemConfigModule,
  ],
  controllers: [FxController],
  providers: [
    CbarRateSyncService,
    FxRevaluationService,
    FxRevaluationCron,
    CurrencyConverterService,
  ],
  exports: [CbarRateSyncService, FxRevaluationService, CurrencyConverterService],
})
export class FxModule {}
