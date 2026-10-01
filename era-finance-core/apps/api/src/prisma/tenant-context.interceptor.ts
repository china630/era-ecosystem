import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { actorContextStorage } from "../common/actor-context";
import type { RequestWithAuditEngagement } from "../common/request-with-audit-engagement";
import { tenantContextStorage } from "./tenant-context";

/**
 * Заполняет AsyncLocalStorage для Prisma tenant extension.
 * Порядок Nest: Guards → Interceptors → handler — JWT уже установил req.user.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: {
        userId?: string;
        organizationId?: string;
        isSuperAdmin?: boolean;
      };
      originalUrl?: string;
      url?: string;
      buyerSession?: { organizationId?: string };
    } & RequestWithAuditEngagement>();
    const url = (req.originalUrl ?? req.url ?? "").split("?")[0];
    const user = req.user;

    const runWithContexts = (tenantStore: {
      organizationId: string | null;
      skipTenantFilter: boolean;
    }) =>
      tenantContextStorage.run(tenantStore, () =>
        actorContextStorage.run({ userId: user?.userId ?? null }, () => next.handle()),
      );

    /**
     * Public / service-token routes without a signed org get `organizationId: null`:
     * tenant models then throw, so such handlers enter the org context explicitly
     * (`runWithTenantContextAsync`) once the org is known from the token / directory.
     */
    if (!user) {
      return runWithContexts({
        organizationId: req.buyerSession?.organizationId ?? null,
        skipTenantFilter: false,
      });
    }

    const effectiveOrgId =
      req.auditEngagementEffectiveOrgId ?? user.organizationId ?? null;

    /** TZ §15 / PRD §7.6: маршруты `/api/admin/*` — супер-админ видит всю систему (Prisma без merge по organizationId). */
    const skipTenantFilter =
      Boolean(user.isSuperAdmin) && url.startsWith("/api/admin");

    return runWithContexts({
      organizationId: effectiveOrgId,
      skipTenantFilter,
    });
  }
}
