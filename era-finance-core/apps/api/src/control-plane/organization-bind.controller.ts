import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  applyOrganizationBind,
  assertEnvServiceToken,
  hydrateOrganizationBindFromDb,
  resolveSatelliteOrganizationId,
} from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationBindBodyDto } from "./organization-bind.dto";

@ApiTags("internal")
@Controller("internal/v1/organization/bind")
@Public()
export class OrganizationBindController {
  constructor(private readonly prisma: PrismaService) {}

  private authorize(authorization?: string, xServiceToken?: string) {
    const auth = assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
        "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
        "FINANCE_INTERNAL_SERVICE_TOKEN",
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
    await hydrateOrganizationBindFromDb(this.prisma);
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
      prisma: this.prisma,
    });
    return {
      ok: true,
      organizationId: body.organizationId,
      source: "runtime" as const,
    };
  }
}
