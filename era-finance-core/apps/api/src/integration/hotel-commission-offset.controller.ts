import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";
import { CP_PERMISSION } from "@era/contracts";
import {
  PEER_SATELLITE_HOTEL,
  resolvePeerSatelliteBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";

class OffsetDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  hotelLineIds!: string[];

  @ApiProperty()
  @IsString()
  financeOffsetId!: string;
}

/**
 * P3: Finance AR↔AP offset — notify hotel to mark commission lines PAID.
 * Does not auto-net on hotel City Ledger; accountant posts GL separately.
 */
@ApiTags("integration")
@ApiBearerAuth("bearer")
@Controller("integration/hotel-commission-offset")
@UseGuards(PermissionsGuard)
export class HotelCommissionOffsetController {
  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Notify hotel that commission lines were offset against AR" })
  async apply(@OrganizationId() organizationId: string, @Body() dto: OffsetDto) {
    const token = resolveSatelliteEventServiceToken();
    if (!token) {
      return { ok: false, error: "SATELLITE_EVENT_SERVICE_TOKEN missing" };
    }
    const peer = await resolvePeerSatelliteBaseUrl({
      organizationId,
      satelliteKey: PEER_SATELLITE_HOTEL,
    });
    const res = await fetch(
      `${peer.baseUrl}/api/internal/v1/agency-commission/commission-offset-applied`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          lineIds: dto.hotelLineIds,
          financeOffsetId: dto.financeOffsetId,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, status: res.status, detail: detail.slice(0, 400) };
    }
    return { ok: true };
  }
}
