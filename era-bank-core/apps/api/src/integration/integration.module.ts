import { Module } from "@nestjs/common";

import { DataHubClient } from "./data-hub.client";

import { FinanceBridgeController } from "./finance-bridge.controller";

import { MdmClient } from "./mdm.client";

import { OrchestratorEventsPublisher } from "./orchestrator-events.publisher";



@Module({

  controllers: [FinanceBridgeController],

  providers: [DataHubClient, MdmClient, OrchestratorEventsPublisher],

  exports: [DataHubClient, MdmClient, OrchestratorEventsPublisher],

})

export class IntegrationModule {}


