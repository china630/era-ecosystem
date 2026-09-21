import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  sessionHasAnyCpPermission,
} from "@era/contracts";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { AuthUser } from "../../auth/types/auth-user";
import type { RequestWithAuditEngagement } from "../request-with-audit-engagement";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<
      {
        user?: AuthUser;
        method?: string;
        originalUrl?: string;
        url?: string;
      } & RequestWithAuditEngagement
    >();
    const user = req.user;
    if (!user) throw new ForbiddenException();
    if (user.isSuperAdmin || user.isOwner) return true;

    if (this.allowAuditEngagementGuest(req, required)) return true;

    const granted = Array.isArray(user.permissions) ? user.permissions : [];

    if (sessionHasAnyCpPermission(granted, required)) return true;
    throw new ForbiddenException("Missing permission");
  }

  /**
   * External auditor invite: GET audit-hub / activity when engagement headers resolved.
   * Ported from retired RolesGuard (Wave 5 residual).
   */
  private allowAuditEngagementGuest(
    req: {
      method?: string;
      originalUrl?: string;
      url?: string;
    } & RequestWithAuditEngagement,
    _required: string[],
  ): boolean {
    const engOrg = req.auditEngagementEffectiveOrgId;
    if (!engOrg) return false;
    const method = (req.method ?? "GET").toUpperCase();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
    const perms = req.auditEngagementInvitePermissions;
    if (method === "GET" || method === "HEAD") {
      if (url.startsWith("/api/audit-hub") && perms?.auditHubRead !== false) {
        return true;
      }
      if (url.startsWith("/api/activity/") && perms?.auditHubRead !== false) {
        return true;
      }
    }
    if (method === "POST" && url.includes("/api/audit-hub/bulk-export")) {
      return perms?.auditBulkExport === true;
    }
    if (
      method === "POST" &&
      perms?.auditNotesWrite !== false &&
      /\/api\/activity\/[^/]+\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\/comments$/i.test(
        url,
      )
    ) {
      return true;
    }
    if (
      (method === "PATCH" || method === "DELETE") &&
      perms?.auditNotesWrite !== false &&
      /\/api\/activity\/comments\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
        url,
      )
    ) {
      return true;
    }
    return false;
  }
}
