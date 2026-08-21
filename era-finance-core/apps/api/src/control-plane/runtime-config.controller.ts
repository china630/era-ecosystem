import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  applyOrganizationBind,
  applySatelliteRuntimeConfig,
  assertEnvServiceToken,
  hydrateRuntimeConfigFromDb,
  onSatelliteBoot,
  publicRuntimeConfigView,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { RuntimeConfigBodyDto } from "./runtime-config.dto";

@ApiTags("internal")
@Controller("internal/v1/runtime-config")
@Public()
export class RuntimeConfigController {
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
  @ApiOperation({ summary: "Desired-state runtime config (no secrets)" })
  async get(
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    await hydrateRuntimeConfigFromDb(this.prisma);
    return {
      ok: true,
      config: publicRuntimeConfigView(satelliteRuntimeConfig()),
    };
  }

  @Post()
  @ApiOperation({ summary: "Apply orchestrator desired-state runtime config" })
  async post(
    @Body() body: RuntimeConfigBodyDto,
    @Headers("authorization") authorization?: string,
    @Headers("x-service-token") xServiceToken?: string,
  ) {
    this.authorize(authorization, xServiceToken);
    if (body.organizationId) {
      await applyOrganizationBind({
        organizationId: body.organizationId,
        boundBy: body.updatedBy ?? "runtime-config",
        prisma: this.prisma,
      });
    }
    const cfg = await applySatelliteRuntimeConfig({
      config: {
        organizationId: body.organizationId,
        orchestratorEventUrl: body.orchestratorEventUrl,
        publicBaseUrl: body.publicBaseUrl,
        platformSuperAdminEmails: body.platformSuperAdminEmails,
        ssoSharedSecret: body.ssoSharedSecret,
        satelliteEventServiceToken: body.satelliteEventServiceToken,
        activeModules: body.activeModules,
        hotelModules: body.hotelModules,
        deploymentTopology: body.deploymentTopology,
        edition: body.edition,
      },
      updatedBy: body.updatedBy,
      prisma: this.prisma,
    });
    return { ok: true, config: publicRuntimeConfigView(cfg) };
  }
}

export async function bootFinanceRuntimeConfig(prisma: PrismaService): Promise<void> {
  await onSatelliteBoot({ prisma });
}
