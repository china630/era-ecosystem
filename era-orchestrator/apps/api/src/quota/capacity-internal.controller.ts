import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from "@nestjs/common";
import { IsInt, IsString, Min } from "class-validator";
import { extractServiceToken } from "../common/utils/internal-service-token.util";
import { QuotaService } from "./quota.service";

class ReportPosStationsDto {
  @IsString()
  organizationId!: string;

  @IsString()
  satelliteKey!: string;

  @IsInt()
  @Min(0)
  billableStationCount!: number;
}

/**
 * Satellites report ERA till/register count (not KKM devices).
 * Authorization: Bearer SATELLITE_EVENT_SERVICE_TOKEN.
 */
@Controller("v1/internal/capacity")
export class CapacityInternalController {
  constructor(private readonly quota: QuotaService) {}

  @Post("pos-stations")
  async reportPosStations(
    @Body() body: ReportPosStationsDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const token = extractServiceToken(authorization, xServiceToken);
    if (!expected || !token || token !== expected) {
      throw new ForbiddenException("Invalid service token");
    }
    return this.quota.assertPosStationOverage(
      body.organizationId,
      body.satelliteKey,
      body.billableStationCount,
    );
  }
}
