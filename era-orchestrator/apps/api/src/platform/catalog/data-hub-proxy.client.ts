import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DataHubProxyClient {
  private readonly logger = new Logger(DataHubProxyClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>("ERA_DATA_HUB_URL") ?? "http://127.0.0.1:4200"
    ).replace(/\/$/, "");
  }

  private serviceToken(): string {
    return (
      this.config.get<string>("DATA_HUB_SERVICE_TOKEN")?.trim() ??
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ??
      ""
    );
  }

  async getJson<T>(registryPath: string): Promise<T> {
    const token = this.serviceToken();
    if (!token) {
      throw new ServiceUnavailableException(
        "DATA_HUB_SERVICE_TOKEN not configured on orchestrator",
      );
    }
    const path = registryPath.startsWith("/")
      ? registryPath
      : `/${registryPath}`;
    const url = `${this.baseUrl()}/registry/v1${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-service-token": token,
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 404) {
        return null as T;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        this.logger.warn(`data-hub GET ${path} failed ${res.status}: ${detail}`);
        throw new ServiceUnavailableException(
          `Reference data hub unavailable (${res.status})`,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `data-hub GET ${path} error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException("Reference data hub unreachable");
    }
  }
}
