import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { DboOpenApiService, type OpenApiKeyConfig } from "./dbo-open-api.service";

export type OpenApiRequest = Request & {
  openApiKey?: OpenApiKeyConfig;
};

@Injectable()
export class OpenApiGuard implements CanActivate {
  constructor(private readonly openApi: DboOpenApiService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<OpenApiRequest>();
    const rawKey = req.headers["x-api-key"];
    const key = typeof rawKey === "string" ? rawKey : undefined;
    const clientIp =
      (typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
        : undefined) ?? req.ip;
    try {
      req.openApiKey = this.openApi.authenticate(key, clientIp);
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Open API authentication failed");
    }
  }
}
