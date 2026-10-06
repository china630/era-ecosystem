import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { WorkforceFeature } from "@era365/database";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { ORG_HEADER } from "../../common/org-id.decorator";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";

export const WORKFORCE_FEATURE = "workforceFeature";

export const RequireWorkforceFeature = (feature: WorkforceFeature) =>
  SetMetadata(WORKFORCE_FEATURE, feature);

function organizationIdFromRequest(req: {
  user?: EraJwtPayload;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const jwtOrg = req.user?.organizationId?.trim() || "";
  const raw = req.headers[ORG_HEADER];
  const headerOrg = typeof raw === "string" ? raw.trim() : "";
  if (jwtOrg) {
    if (headerOrg && headerOrg !== jwtOrg && !req.user?.isSuperAdmin) {
      throw new ForbiddenException("Organization header mismatch");
    }
    return jwtOrg;
  }
  if (headerOrg && req.user?.isSuperAdmin) return headerOrg;
  throw new ForbiddenException(
    "No organization context: select or create a company first.",
  );
}

@Injectable()
export class WorkforcePackageGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlement: WorkforceEntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<WorkforceFeature | undefined>(
      WORKFORCE_FEATURE,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;
    const req = context.switchToHttp().getRequest<{
      user?: EraJwtPayload;
      headers: Record<string, string | string[] | undefined>;
    }>();
    if (req.user?.isSuperAdmin) return true;
    const organizationId = organizationIdFromRequest(req);
    await this.entitlement.assertWorkforceFeature(organizationId, feature);
    return true;
  }
}
