import { Global, Module } from "@nestjs/common";
import { OrchestratorMdmClientService } from "./orchestrator-mdm-client.service";
import { OrchestratorHoldingsClientService } from "./orchestrator-holdings-client.service";

@Global()
@Module({
  providers: [OrchestratorMdmClientService, OrchestratorHoldingsClientService],
  exports: [OrchestratorMdmClientService, OrchestratorHoldingsClientService],
})
export class OrchestratorModule {}
