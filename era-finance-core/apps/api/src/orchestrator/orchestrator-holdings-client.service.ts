import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type ControlPlaneHolding = {
  id: string;
  name: string;
  baseCurrency: string;
  organizationIds: string[];
  organizations: Array<{ id: string; name: string }>;
  canViewReports: boolean;
};

@Injectable()
export class OrchestratorHoldingsClientService {
  private readonly logger = new Logger(OrchestratorHoldingsClientService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>("ORCHESTRATOR_INTERNAL_URL") ??
      process.env.CONTROL_PLANE_URL ??
      "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
  }

  private token(): string {
    return (
      this.config.get<string>("ORCHESTRATOR_SERVICE_TOKEN")?.trim() ??
      this.config.get<string>("CONTROL_PLANE_SERVICE_TOKEN")?.trim() ??
      ""
    );
  }

  private authHeaders(): Record<string, string> {
    const token = this.token();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-service-token": token,
    };
  }

  async listHoldingsForUser(userId: string): Promise<ControlPlaneHolding[]> {
    const token = this.token();
    if (!token) {
      this.logger.warn(
        "ORCHESTRATOR_SERVICE_TOKEN missing; holdings list returns empty",
      );
      return [];
    }
    try {
      const url = new URL(`${this.baseUrl()}/internal/v1/holdings`);
      url.searchParams.set("userId", userId);
      const res = await fetch(url, { headers: this.authHeaders() });
      if (!res.ok) {
        this.logger.warn(`Holdings list HTTP ${res.status}`);
        return [];
      }
      return (await res.json()) as ControlPlaneHolding[];
    } catch (e) {
      this.logger.warn(
        `Holdings list failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return [];
    }
  }

  async getHoldingForUser(
    userId: string,
    holdingId: string,
  ): Promise<ControlPlaneHolding> {
    const token = this.token();
    if (!token) {
      throw new ForbiddenException({
        code: "HOLDING_CP_UNAVAILABLE",
        message: "Control plane holdings service is not configured.",
      });
    }
    try {
      const url = new URL(
        `${this.baseUrl()}/internal/v1/holdings/${encodeURIComponent(holdingId)}`,
      );
      url.searchParams.set("userId", userId);
      const res = await fetch(url, { headers: this.authHeaders() });
      if (res.status === 404) {
        throw new NotFoundException(`Holding with ID ${holdingId} not found`);
      }
      if (res.status === 403) {
        throw new ForbiddenException({
          code: "HOLDING_ACCESS_DENIED",
          message: "No access to this holding.",
        });
      }
      if (!res.ok) {
        this.logger.warn(`Holding get HTTP ${res.status}`);
        throw new ForbiddenException({
          code: "HOLDING_CP_ERROR",
          message: "Could not resolve holding from control plane.",
        });
      }
      return (await res.json()) as ControlPlaneHolding;
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof ForbiddenException
      ) {
        throw e;
      }
      this.logger.warn(
        `Holding get failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new ForbiddenException({
        code: "HOLDING_CP_ERROR",
        message: "Could not resolve holding from control plane.",
      });
    }
  }

  async userMayViewAnyHoldingReport(userId: string): Promise<boolean> {
    const list = await this.listHoldingsForUser(userId);
    return list.some((h) => h.canViewReports);
  }
}
