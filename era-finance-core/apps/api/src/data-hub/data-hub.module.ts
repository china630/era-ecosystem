import { Global, Module } from "@nestjs/common";
import { DataHubClientService } from "./data-hub-client.service";

@Global()
@Module({
  providers: [DataHubClientService],
  exports: [DataHubClientService],
})
export class DataHubModule {}
