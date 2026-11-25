import { Body, Controller, Post, Req, UnauthorizedException, BadRequestException, HttpException } from "@nestjs/common";
import {
  handleStaffProvisionEvent,
  SatelliteLoginTakenError,
  SatelliteTargetAmbiguousError,
  UnknownSatelliteRoleError,
} from "@/lib/staff-provision";
import { expressKitHeaders } from "@era/satellite-kit";
import { enterRequestTenant } from "@/lib/request-organization";
import type { ConstructionRequest } from "../session";

@Controller("api/integration")
export class IntegrationController {
  @Post("staff-provision")
  async provision(@Req() req: ConstructionRequest, @Body() body: unknown) {
    const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
    const header = expressKitHeaders(req).get("x-satellite-bridge-secret")?.trim() ?? "";
      if (!secret) {
        if (process.env.NODE_ENV === "production") {
          throw new UnauthorizedException({ error: "Unauthorized" });
        }
      } else if (header !== secret) {
        throw new UnauthorizedException({ error: "Unauthorized" });
      }

      try {
        const event = body as { organizationId?: string };
        const organizationId =
          typeof event.organizationId === "string" ? event.organizationId.trim() : "";
        if (!organizationId) {
          throw new BadRequestException({ error: "organizationId required" });
        }
        enterRequestTenant(organizationId);
        return await handleStaffProvisionEvent(event);
      } catch (err) {
        if (err instanceof HttpException) throw err;
        const message = err instanceof Error ? err.message : "Provision failed";
        const prismaCode =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: unknown }).code)
            : "";
        const code =
          err instanceof SatelliteLoginTakenError || prismaCode === "P2002"
            ? "LOGIN_TAKEN"
            : err instanceof SatelliteTargetAmbiguousError
              ? "TARGET_AMBIGUOUS"
              : err instanceof UnknownSatelliteRoleError
                ? "UNKNOWN_SATELLITE_ROLE"
                : undefined;
        const status = code === "LOGIN_TAKEN" || code === "TARGET_AMBIGUOUS" ? 409 : 400;
        throw new HttpException({ error: message, ...(code ? { code } : {}) }, status);
      }
  }
}
