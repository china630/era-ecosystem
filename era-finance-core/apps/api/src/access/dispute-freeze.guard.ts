import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma, SecurityMode } from "@erafinance/database";
import { TenantPrismaRawService } from "../prisma/tenant-prisma-raw.service";

export const ALLOW_IN_DISPUTE_MODE = "allowInDisputeMode";

/** Routes marked with @AllowInDisputeMode skip freeze checks. */
export const AllowInDisputeMode = () => SetMetadata(ALLOW_IN_DISPUTE_MODE, true);

function isFrozenWrite(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PATCH" || m === "PUT" || m === "DELETE";
}

@Injectable()
export class DisputeFreezeGuard implements CanActivate {
  constructor(
    private readonly raw: TenantPrismaRawService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_DISPUTE_MODE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allow) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      user?: { organizationId?: string | null; isSuperAdmin?: boolean };
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0];
    if (url.includes("/api/admin") || url.includes("/api/public") || url.includes("/api/auth")) {
      return true;
    }
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return true;
    }
    // Guards run before TenantContextInterceptor: the tenant Prisma extension has no context yet.
    const rows = await this.raw.$queryRaw<Array<{ mode: string }>>(
      orgId,
      Prisma.sql`SELECT mode::text AS mode FROM organization_security_states WHERE organization_id = ${orgId}::uuid LIMIT 1`,
    );
    const mode = (rows[0]?.mode as SecurityMode | undefined) ?? SecurityMode.NORMAL;

    if (mode === SecurityMode.HARD_BLOCK_PLATFORM) {
      const m = (req.method ?? "GET").toUpperCase();
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
        throw new ForbiddenException("Organization blocked by platform security (HARD_BLOCK_PLATFORM)");
      }
      return true;
    }

    if (mode !== SecurityMode.DISPUTE && mode !== SecurityMode.ROLLBACK_IN_PROGRESS) {
      return true;
    }
    const m = (req.method ?? "GET").toUpperCase();
    if (m === "DELETE") {
      throw new ForbiddenException("Mutations frozen during dispute / rollback");
    }
    if (isFrozenWrite(m)) {
      const path = url.replace(/^.*\/api/, "/api");
      if (/\/archive\b/i.test(path)) {
        throw new ForbiddenException("Archive frozen during dispute / rollback");
      }
      if (path.includes("/subscription")) {
        throw new ForbiddenException("Subscription changes frozen during dispute / rollback");
      }
      if (path.includes("/organizations") && path.includes("transfer-ownership")) {
        throw new ForbiddenException("Ownership transfer frozen during dispute / rollback");
      }
      if (path.includes("/migration")) {
        throw new ForbiddenException("Migration frozen during dispute / rollback");
      }
      if (path.includes("/hard-delete")) {
        throw new ForbiddenException("Hard-delete frozen during dispute / rollback");
      }
    }
    return true;
  }
}
