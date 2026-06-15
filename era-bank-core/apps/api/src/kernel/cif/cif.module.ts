import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { AuditModule } from "../audit/audit.module";
import { CifController } from "./cif.controller";
import { CifService } from "./cif.service";

@Module({
  imports: [AuditModule, IntegrationModule],
  controllers: [CifController],
  providers: [CifService],
  exports: [CifService],
})
export class CifModule {}