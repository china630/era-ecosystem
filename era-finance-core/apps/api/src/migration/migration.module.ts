import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { CounterpartiesModule } from "../counterparties/counterparties.module";
import { SatelliteIntegrationModule } from "../integration/integration.module";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProductsModule } from "../products/products.module";
import { MigrationAssembleService } from "./migration-assemble.service";
import {
  MigrationController,
  OpeningBalancesLegacyController,
} from "./migration.controller";
import { MigrationTemplateService } from "./migration-template.service";
import { MigrationUploadService } from "./migration-upload.service";

@Module({
  imports: [
    PrismaModule,
    AccountingModule,
    OrchestratorModule,
    CounterpartiesModule,
    ProductsModule,
    SatelliteIntegrationModule,
  ],
  controllers: [MigrationController, OpeningBalancesLegacyController],
  providers: [
    MigrationTemplateService,
    MigrationUploadService,
    MigrationAssembleService,
  ],
})
export class MigrationModule {}
