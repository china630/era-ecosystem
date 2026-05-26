import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../auth/constants";
import type { AuthUser } from "../../auth/types/auth-user";
import { verifyControlPlaneAccessToken } from "../utils/verify-control-plane-jwt";

/**
 * Stateless JWT authentication for finance API (control-plane IdP).
 * HS256 (local) or RS256 via JWKS (staging/prod dual-mode).
 */
@Injectable()
export class ControlPlaneAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const payload = await verifyControlPlaneAccessToken(token, this.config);
    if (!payload) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    req.user = {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId ?? null,
      role: payload.role ?? null,
      roles: payload.roles ?? (payload.role ? [payload.role] : []),
      permissions: payload.permissions ?? [],
      isOwner: Boolean(payload.isOwner),
      isSuperAdmin: Boolean(payload.isSuperAdmin),
    };
    return true;
  }
}
