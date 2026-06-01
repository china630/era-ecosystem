import { Global, Module } from "@nestjs/common";
import { PrismaHubService } from "./prisma-hub.service";
import { PrismaFinanceRoService } from "./prisma-finance-ro.service";
import { DataSourceService } from "./data-source.service";

@Global()
@Module({
  providers: [PrismaHubService, PrismaFinanceRoService, DataSourceService],
  exports: [PrismaHubService, PrismaFinanceRoService, DataSourceService],
})
export class PrismaModule {}
