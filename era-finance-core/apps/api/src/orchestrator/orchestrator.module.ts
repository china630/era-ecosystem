import { Global, Module } from "@nestjs/common";
import { OrchestratorMdmClientService } from "./orchestrator-mdm-client.service";

@Global()
@Module({
  providers: [OrchestratorMdmClientService],
  exports: [OrchestratorMdmClientService],
})
export class OrchestratorModule {}
