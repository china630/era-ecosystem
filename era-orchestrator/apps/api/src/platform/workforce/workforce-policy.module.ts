import { Module } from "@nestjs/common";

import { PlatformSharedModule } from "../platform-shared.module";

import { SatelliteCatalogGuard } from "../catalog/satellite-catalog.guard";

import { WorkforcePolicyController } from "./workforce-policy.controller";

import { WorkforcePolicyService } from "./workforce-policy.service";



@Module({

  imports: [PlatformSharedModule],

  controllers: [WorkforcePolicyController],

  providers: [WorkforcePolicyService, SatelliteCatalogGuard],

  exports: [WorkforcePolicyService],

})

export class WorkforcePolicyModule {}

