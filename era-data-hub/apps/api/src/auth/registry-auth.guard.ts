import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { ServiceTokenGuard } from "./service-token.guard";

@Injectable()
export class RegistryAuthGuard implements CanActivate {
  constructor(
    private readonly apiKey: ApiKeyGuard,
    private readonly serviceToken: ServiceTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.serviceToken.canActivate(context)) return true;
    try {
      if (await this.apiKey.canActivate(context)) return true;
    } catch {
      /* fall through */
    }
    throw new UnauthorizedException({
      code: "UNAUTHORIZED",
      message: "Valid X-Api-Key or service Bearer token required",
    });
  }
}
