import { Module } from "@nestjs/common";
import { PlatformSharedModule } from "../platform-shared.module";
import { CatalogCalendarController } from "./catalog-calendar.controller";
import { CatalogCompaniesController } from "./catalog-companies.controller";
import { CatalogFxController } from "./catalog-fx.controller";
import { CatalogGatewayService } from "./catalog-gateway.service";
import { DataHubProxyClient } from "./data-hub-proxy.client";
import { SatelliteCatalogGuard } from "./satellite-catalog.guard";

@Module({
  imports: [PlatformSharedModule],
  controllers: [
    CatalogCalendarController,
    CatalogFxController,
    CatalogCompaniesController,
  ],
  providers: [CatalogGatewayService, DataHubProxyClient, SatelliteCatalogGuard],
  exports: [CatalogGatewayService],
})
export class CatalogGatewayModule {}
