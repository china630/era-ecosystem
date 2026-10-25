import { Global, Module } from "@nestjs/common";
import { PrismaHubService } from "./prisma-hub.service";
import { DataSourceService } from "./data-source.service";

@Global()
@Module({
  providers: [PrismaHubService, DataSourceService],
  exports: [PrismaHubService, DataSourceService],
})
export class PrismaModule {}
