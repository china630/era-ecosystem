import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>("DATA_HUB_SERVICE_TOKEN")?.trim();
    if (!expected) return false;
    const header = req.headers.authorization?.trim();
    const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const token = bearer ?? (req.headers["x-service-token"] as string | undefined)?.trim();
    if (token && token === expected) {
      (req as Request & { authKind?: string }).authKind = "service";
      return true;
    }
    return false;
  }
}
