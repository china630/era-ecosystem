import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { normalizeFin } from "../security/pii-crypto.util";

export type OrchestratorFinLookupResult = {
  found: boolean;
  globalPersonId?: string;
  fullName?: string | null;
  phone?: string | null;
  masked?: boolean;
};

@Injectable()
export class OrchestratorMdmClientService {
  private readonly logger = new Logger(OrchestratorMdmClientService.name);

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

  async lookupPersonByFin(
    fin: string,
    requesterOrgId: string,
  ): Promise<OrchestratorFinLookupResult | null> {
    const normalized = normalizeFin(fin);
    if (!/^[0-9A-HJ-NP-Za-hj-np-z]{7}$/.test(normalized)) {
      return { found: false };
    }
    const token = this.token();
    if (!token) {
      this.logger.warn("ORCHESTRATOR_SERVICE_TOKEN missing; skip FIN lookup");
      return null;
    }
    try {
      const res = await fetch(`${this.baseUrl()}/internal/v1/mdm/persons/lookup-by-fin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fin: normalized,
          requesterOrgId,
          purpose: "counterparty_verify",
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Orchestrator FIN lookup HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as OrchestratorFinLookupResult;
    } catch (e) {
      this.logger.warn(
        `Orchestrator FIN lookup failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
