import { Module } from "@nestjs/common";
import { IntegrationModule } from "../../integration/integration.module";
import { AmlController } from "./aml.controller";
import { AmlMonitoringService } from "./aml-monitoring.service";
import { AmlService } from "./aml.service";

@Module({
  imports: [IntegrationModule],
  controllers: [AmlController],
  providers: [AmlService, AmlMonitoringService],
  exports: [AmlService],
})
export class AmlModule {}
