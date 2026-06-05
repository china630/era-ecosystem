import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("FINANCE_INTERNAL_SERVICE_TOKEN")?.trim();
    if (!expected) return true;
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice(7).trim()
      : header?.trim();
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid internal service token");
    }
    return true;
  }
}
