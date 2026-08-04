import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { EraJwtPayload } from "../auth/jwt-payload.type";

export const ORG_HEADER = "x-organization-id";

/**
 * SEC-CP-03: organization context comes from JWT.
 * Header may only override for platform super-admins (support tooling).
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{
      user?: EraJwtPayload;
      headers: Record<string, string | undefined>;
    }>();
    const jwtOrg = req.user?.organizationId?.trim() || "";
    const raw =
      req.headers[ORG_HEADER] ?? req.headers[ORG_HEADER.toUpperCase()];
    const headerOrg = typeof raw === "string" ? raw.trim() : "";

    if (jwtOrg) {
      if (headerOrg && headerOrg !== jwtOrg && !req.user?.isSuperAdmin) {
        throw new ForbiddenException("Organization header mismatch");
      }
      return jwtOrg;
    }

    if (headerOrg && req.user?.isSuperAdmin) {
      return headerOrg;
    }

    throw new ForbiddenException(
      "No organization context: select or create a company first.",
    );
  },
);
