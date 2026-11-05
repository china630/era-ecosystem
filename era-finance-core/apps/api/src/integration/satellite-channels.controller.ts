import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";
import { CP_PERMISSION } from "@era/contracts";
import {
  resolveOperatingMode,
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "@era/satellite-kit";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";

class PatchChannelDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags("integration")
@ApiBearerAuth("bearer")
@Controller("integration/channels")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SatelliteChannelsController {
  @Get()
  @Permissions(CP_PERMISSION.API_BILLING_MANAGE)
  @ApiOperation({ summary: "List integration channels for the active org" })
  async list(@OrganizationId() organizationId: string) {
    const base = resolveOrchestratorBaseUrl({ fallback: "" }).replace(/\/$/, "");
    const token = resolveSatelliteEventServiceToken();
    if (!base || !token) {
      return { outbound: [], inbound: [], operatingMode: null, organizationId };
    }
    const res = await fetch(`${base}/v1/internal/channels`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "X-Organization-Id": organizationId,
      },
      cache: "no-store",
    }).catch(() => null);
    const body = res?.ok
      ? ((await res.json()) as {
          outbound?: unknown[];
          inbound?: unknown[];
        })
      : { outbound: [], inbound: [] };
    const operatingMode = await resolveOperatingMode(organizationId).catch(
      () => null,
    );
    return {
      outbound: body.outbound ?? [],
      inbound: body.inbound ?? [],
      operatingMode,
      organizationId,
    };
  }

  @Patch(":channelId")
  @Permissions(CP_PERMISSION.API_BILLING_MANAGE)
  @ApiOperation({ summary: "Disable an inbound ACCEPTOR channel" })
  async patch(
    @OrganizationId() organizationId: string,
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Body() dto: PatchChannelDto,
  ) {
    const base = resolveOrchestratorBaseUrl({ fallback: "" }).replace(/\/$/, "");
    const token = resolveSatelliteEventServiceToken();
    if (!base || !token) {
      return { ok: false, error: "Orchestrator channel API unavailable" };
    }
    const res = await fetch(`${base}/v1/internal/channels/${channelId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "X-Organization-Id": organizationId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: dto.enabled }),
    }).catch(() => null);
    if (!res?.ok) {
      return {
        ok: false,
        status: res?.status ?? 503,
        error: "Channel update failed",
      };
    }
    return { ok: true };
  }
}
