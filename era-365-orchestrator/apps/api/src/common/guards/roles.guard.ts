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
    if (!role || !required.includes(role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
