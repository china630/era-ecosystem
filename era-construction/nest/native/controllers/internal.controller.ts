import { Controller, Get, Query, Req, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { expressKitHeaders } from "@era/satellite-kit";
import { enterRequestTenant } from "@/lib/request-organization";
import { listWorkforceRoleCodes } from "@/lib/workforce-roles.service";
import type { ConstructionRequest } from "../session";

function bridgeSecret(): string {
  return process.env.SATELLITE_BRIDGE_SECRET?.trim() || "";
}

@Controller("api/internal/v1")
export class InternalController {
  @Get("workforce/roles")
  async roles(
    @Req() req: ConstructionRequest,
    @Query("organizationId") organizationIdQuery?: string,
  ) {
    const secret = bridgeSecret();
    const header = expressKitHeaders(req).get("x-satellite-bridge-secret")?.trim() ?? "";
      if (!secret || header !== secret) {
        throw new UnauthorizedException({ error: "Unauthorized" });
      }
      const organizationId = organizationIdQuery?.trim() ?? "";
      if (!organizationId) {
        throw new BadRequestException({ error: "organizationId required" });
      }
      enterRequestTenant(organizationId);
      const roles = await listWorkforceRoleCodes(organizationId);
      return {
        roles: roles.map((role) => ({
          code: role.code,
          name: role.name,
          active: true,
        })),
      };
  }
}
