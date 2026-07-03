import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { extractServiceToken } from "../../common/utils/internal-service-token.util";

export const SATELLITE_ORG_ID_KEY = "satelliteOrganizationId";

@Injectable()
export class SatelliteCatalogGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      query?: Record<string, string | undefined>;
      [SATELLITE_ORG_ID_KEY]?: string;
    }>();

    const token = extractServiceToken(
      req.headers.authorization,
      req.headers["x-service-token"],
    );
    const satelliteToken = this.config
      .get<string>("SATELLITE_EVENT_SERVICE_TOKEN")
      ?.trim();
    const controlPlaneToken = this.config
      .get<string>("CONTROL_PLANE_SERVICE_TOKEN")
      ?.trim();

    const allowed = new Set(
      [satelliteToken, controlPlaneToken].filter(Boolean) as string[],
    );
    if (allowed.size > 0 && (!token || !allowed.has(token))) {
      throw new UnauthorizedException("Invalid satellite service token");
    }

    const orgId =
      req.headers["x-organization-id"]?.trim() ??
      req.query?.organizationId?.trim();
    if (!orgId) {
      throw new BadRequestException(
        "X-Organization-Id header or organizationId query required",
      );
    }
    req[SATELLITE_ORG_ID_KEY] = orgId;
    return true;
  }
}
