import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: EraJwtPayload }>();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException("Super admin required");
    }
    return true;
  }
}
