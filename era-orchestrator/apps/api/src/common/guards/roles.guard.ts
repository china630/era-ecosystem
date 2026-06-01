import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@era365/database";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user: EraJwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException();

    if (user.isSuperAdmin) return true;
    const role = user.role;
    if (role && required.includes(role)) return true;
    const perms = user.permissions ?? [];
    const roleFallback: Record<UserRole, string> = {
      OWNER: "billing.manage",
      ADMIN: "reporting.view",
      ACCOUNTANT: "accounting.post",
      USER: "reporting.view",
      PROCUREMENT: "purchases.manage",
      AUDITOR: "reporting.view",
      WAREHOUSE_KEEPER: "inventory.manage",
      HR_OFFICER: "hr.manage",
      HR_MANAGER: "hr.manage",
      DEPARTMENT_HEAD: "reporting.view",
      DIRECTOR: "billing.manage",
      PARTNER: "reporting.view",
    };
    const needed = required
      .map((r) => roleFallback[r])
      .filter((p): p is string => Boolean(p));
    if (needed.some((p) => perms.includes(p))) return true;
    throw new ForbiddenException("Insufficient role");
  }
}
