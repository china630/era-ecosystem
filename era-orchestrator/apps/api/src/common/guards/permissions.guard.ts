import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";

/**
 * Wave 4 Variant A: any-of required permission codes from JWT.
 * Bypass: isSuperAdmin, isOwner. ADMIN does not bypass.
 * Missing/non-array permissions → fail-closed [].
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: EraJwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException();
    if (user.isSuperAdmin) return true;
    if (user.isOwner) return true;

    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (required.some((p) => perms.includes(p))) return true;
    throw new ForbiddenException("Missing permission");
  }
}
