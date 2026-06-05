import { Module } from "@nestjs/common";
import { GlobalCompanyDirectoryModule } from "../global-directory/global-company-directory.module";
import { OrchestratorModule } from "../orchestrator/orchestrator.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TaxModule } from "../tax/tax.module";
import { CounterpartiesController } from "./counterparties.controller";
import { CounterpartiesService } from "./counterparties.service";

@Module({
  imports: [PrismaModule, GlobalCompanyDirectoryModule, TaxModule, OrchestratorModule],
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService],
  exports: [CounterpartiesService],
})
export class CounterpartiesModule {}
