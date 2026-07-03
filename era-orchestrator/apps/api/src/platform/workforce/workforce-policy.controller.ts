import {

  BadRequestException,

  Controller,

  Get,

  Query,

  Req,

  UseGuards,

} from "@nestjs/common";

import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../../auth/decorators/public.decorator";

import {

  SATELLITE_ORG_ID_KEY,

  SatelliteCatalogGuard,

} from "../catalog/satellite-catalog.guard";

import { WorkforcePolicyService } from "./workforce-policy.service";



@ApiTags("platform-workforce")

@Public()

@UseGuards(SatelliteCatalogGuard)

@Controller("platform/v1/workforce")

export class WorkforcePolicyController {

  constructor(private readonly policy: WorkforcePolicyService) {}



  @Get("policy")

  @ApiOperation({ summary: "Workforce hire mode for a satellite deployment" })

  getPolicy(

    @Query("satelliteKey") satelliteKey: string,

    @Req() req: Record<string, string | undefined>,

  ) {

    if (!satelliteKey?.trim()) {

      throw new BadRequestException("satelliteKey query required");

    }

    return this.policy.getPolicy(req[SATELLITE_ORG_ID_KEY]!, satelliteKey.trim());

  }

}

