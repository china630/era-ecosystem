import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthUser } from "../auth/types/auth-user";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { REQUIRES_MODULE_KEY } from "./subscription.constants";
import { SubscriptionAccessService } from "./subscription-access.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: SubscriptionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleName = this.reflector.getAllAndOverride<
      string | readonly string[] | undefined
    >(REQUIRES_MODULE_KEY, [context.getHandler(), context.getClass()]);
    if (!moduleName) {
      return true;
    }

    const req = context.switchToHttp().getRequest<
      { user?: AuthUser } & RequestWithAuditEngagement
    >();
    const orgId =
      req.auditEngagementEffectiveOrgId ?? req.user?.organizationId;
    if (!orgId) {
      throw new UnauthorizedException();
    }

    const opts = {
      userEmail: req.user?.email,
      isSuperAdmin: req.user?.isSuperAdmin,
    };
    const keys = Array.isArray(moduleName) ? moduleName : [moduleName];
    if (keys.length === 1) {
      await this.access.assertModuleAccess(orgId, keys[0]!, opts);
      return true;
    }
    let lastErr: unknown;
    for (const key of keys) {
      try {
        await this.access.assertModuleAccess(orgId, key, opts);
        return true;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }
}
