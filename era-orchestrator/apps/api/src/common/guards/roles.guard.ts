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

/**
 * SEC-CP-02: role checks are exact — no OWNER→billing.manage permission
 * elevation that could satisfy unrelated required roles.
 */
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
    const roles = user.roles ?? [];
    if (roles.some((r) => required.includes(r))) return true;
    throw new ForbiddenException("Insufficient role");
  }
}
