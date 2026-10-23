import { Global, Module } from "@nestjs/common";
import { SystemConfigModule } from "../system-config/system-config.module";
import { DataHubClientService } from "./data-hub-client.service";
import { ReferenceManualController } from "./reference-manual.controller";
import { ReferenceManualService } from "./reference-manual.service";

@Global()
@Module({
  imports: [SystemConfigModule],
  controllers: [ReferenceManualController],
  providers: [DataHubClientService, ReferenceManualService],
  exports: [DataHubClientService, ReferenceManualService],
})
export class DataHubModule {}
