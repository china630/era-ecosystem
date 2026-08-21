import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  applyOrganizationBind,
  assertEnvServiceToken,
  hydrateOrganizationBindFromDb,
  resolveSatelliteOrganizationId,
} from "@era/satellite-kit";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationBindBodyDto } from "./organization-bind.dto";

/**
 * Sync contract path is `/api/internal/v1/organization/bind` (same as industry
 * Next satellites and Finance). Bank-core global prefix is `api/v1`, so this
 * controller registers the absolute path and is excluded from that prefix.
 */
@ApiTags("internal")
@Controller("api/internal/v1/organization/bind")
export class OrganizationBindController {
  constructor(private readonly prisma: PrismaService) {}

  private authorize(authorization?: string, xServiceToken?: string) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
        "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
        "BANK_CORE_SERVICE_TOKEN",
      ],
      authorization,
      xServiceToken,
    });
    if (!auth.ok) {
      throw new UnauthorizedException(auth.error);
    }
  }

  @Get()
  @ApiOperation({ summary: "Satellite organization bind (diagnostics)" })
  async get(
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    await hydrateOrganizationBindFromDb(this.prisma as never);
    const resolved = resolveSatelliteOrganizationId({ allowFallback: true });
    return {
      ok: true,
      organizationId: resolved.organizationId,
      source: resolved.source,
    };
  }

  @Post()
  @ApiOperation({ summary: "Apply orchestrator organization bind" })
  async post(
    @Body() body: OrganizationBindBodyDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    await applyOrganizationBind({
      organizationId: body.organizationId,
      boundBy: body.boundBy,
      prisma: this.prisma as never,
    });
    return {
      ok: true,
      organizationId: body.organizationId,
      source: "runtime" as const,
    };
  }
}
