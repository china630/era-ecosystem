import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DataHubAdminClient {
  private readonly logger = new Logger(DataHubAdminClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>("ERA_DATA_HUB_URL") ?? "http://127.0.0.1:4200"
    ).replace(/\/$/, "");
  }

  private token(): string {
    return this.config.get<string>("DATA_HUB_SERVICE_TOKEN")?.trim() ?? "";
  }

  async getPolicy(): Promise<unknown> {
    return this.request("GET");
  }

  async patchPolicy(body: unknown): Promise<unknown> {
    return this.request("PATCH", body);
  }

  private async request(method: "GET" | "PATCH", body?: unknown): Promise<unknown> {
    const token = this.token();
    if (!token) {
      throw new ServiceUnavailableException("DATA_HUB_SERVICE_TOKEN is not configured");
    }
    const url = `${this.baseUrl()}/registry/v1/admin/reference-policy`;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        this.logger.warn(`data-hub ${method} reference-policy ${res.status}: ${detail}`);
        throw new ServiceUnavailableException(`Data hub policy ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `data-hub reference-policy: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException("Data hub unreachable");
    }
  }
}
