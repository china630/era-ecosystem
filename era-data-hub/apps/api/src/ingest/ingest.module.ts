import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "../prisma/prisma.module";
import { CbarFxService } from "./cbar-fx.service";
import { CbarRateSyncService } from "./cbar-rate-sync.service";
import { FxIngestCron } from "./fx-ingest.cron";
import { FxIngestService } from "./fx-ingest.service";
import { ReferencePolicyService } from "./reference-policy.service";

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), PrismaModule],
  providers: [
    ReferencePolicyService,
    CbarFxService,
    CbarRateSyncService,
    FxIngestService,
    FxIngestCron,
  ],
  exports: [ReferencePolicyService],
})
export class IngestModule {}
