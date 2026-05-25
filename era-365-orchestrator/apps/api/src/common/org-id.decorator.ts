import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { EraJwtPayload } from "../auth/jwt-payload.type";

export const ORG_HEADER = "x-organization-id";

export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{
      user?: EraJwtPayload;
      headers: Record<string, string | undefined>;
    }>();
    if (req.user?.organizationId) {
      return req.user.organizationId;
    }
    const raw = req.headers[ORG_HEADER] ?? req.headers[ORG_HEADER.toUpperCase()];
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id) return id;
    throw new ForbiddenException(
      "No organization context: select or create a company first.",
    );
  },
);
