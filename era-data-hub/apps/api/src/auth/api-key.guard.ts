import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = (this.config.get<string>("PLATFORM_REFERENCE_DATA_MODE") ?? "mvp")
      .trim()
      .toLowerCase();
    const req = context.switchToHttp().getRequest<Request>();
    const key =
      (req.headers["x-api-key"] as string | undefined)?.trim() ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : undefined);
    if (!key) return false;

    if (mode === "mvp") {
      const devKeys = (this.config.get<string>("DATA_HUB_DEV_API_KEYS") ?? "dev-data-hub-key")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (devKeys.includes(key)) {
        (req as Request & { authKind?: string }).authKind = "api-key";
        return true;
      }
      throw new UnauthorizedException({ code: "INVALID_API_KEY", message: "Invalid API key" });
    }

    const orchUrl = (
      this.config.get<string>("CONTROL_PLANE_URL") ?? "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    const serviceToken = this.config.get<string>("CONTROL_PLANE_SERVICE_TOKEN")?.trim();
    if (!serviceToken) {
      throw new UnauthorizedException({
        code: "API_KEY_VALIDATION_UNAVAILABLE",
        message: "CONTROL_PLANE_SERVICE_TOKEN not configured",
      });
    }

    try {
      const res = await fetch(`${orchUrl}/platform/reference-data/v1/validate-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceToken}`,
        },
        body: JSON.stringify({ apiKey: key }),
      });
      if (!res.ok) {
        throw new UnauthorizedException({
          code: res.status === 401 ? "INVALID_API_KEY" : "API_KEY_VALIDATION_FAILED",
          message: "API key validation failed",
        });
      }
      const body = (await res.json()) as { organizationId?: string };
      (req as Request & { authKind?: string; organizationId?: string }).authKind = "api-key";
      if (body.organizationId) {
        (req as Request & { organizationId?: string }).organizationId = body.organizationId;
      }
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({
        code: "API_KEY_VALIDATION_UNAVAILABLE",
        message: "Orchestrator API key validation unreachable",
      });
    }
  }
}
