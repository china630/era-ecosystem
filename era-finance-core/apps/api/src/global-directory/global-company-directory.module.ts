import { Module } from "@nestjs/common";
import { DataHubModule } from "../data-hub/data-hub.module";
import { GlobalCompanyDirectoryService } from "./global-company-directory.service";

@Module({
  imports: [DataHubModule],
  providers: [GlobalCompanyDirectoryService],
  exports: [GlobalCompanyDirectoryService],
})
export class GlobalCompanyDirectoryModule {}
