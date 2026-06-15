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

export type ResolvePersonInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  residencePermit?: string;
  fullName: string;
  phone?: string;
  nationality?: string;
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

  private authHeaders(): Record<string, string> {
    const token = this.token();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-service-token": token,
    };
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
        headers: this.authHeaders(),
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

  async resolvePersonIdentity(
    input: ResolvePersonInput,
  ): Promise<{ globalPersonId: string | null }> {
    const token = this.token();
    if (!token) return { globalPersonId: null };
    try {
      const res = await fetch(`${this.baseUrl()}/internal/v1/mdm/persons/resolve`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        this.logger.warn(`Orchestrator resolve HTTP ${res.status}`);
        return { globalPersonId: null };
      }
      const data = (await res.json()) as { id?: string; globalPersonId?: string };
      return { globalPersonId: data.globalPersonId ?? data.id ?? null };
    } catch (e) {
      this.logger.warn(
        `Orchestrator resolve failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { globalPersonId: null };
    }
  }

  /** Lookup FIN then resolve-or-create (canonical satellite pattern). */
  async linkPersonIdentity(
    input: ResolvePersonInput,
    requesterOrgId?: string,
  ): Promise<{ globalPersonId: string | null; masked?: boolean }> {
    if (input.fin?.trim()) {
      const lookup = await this.lookupPersonByFin(input.fin.trim(), requesterOrgId ?? "");
      if (lookup?.globalPersonId) {
        return { globalPersonId: lookup.globalPersonId, masked: lookup.masked };
      }
    }
    const resolved = await this.resolvePersonIdentity(input);
    return { globalPersonId: resolved.globalPersonId };
  }

  async mergePersons(
    sourcePersonId: string,
    targetPersonId: string,
    actorOrgId: string,
  ): Promise<{ globalPersonId: string | null }> {
    const token = this.token();
    if (!token) return { globalPersonId: null };
    try {
      const res = await fetch(`${this.baseUrl()}/internal/v1/mdm/persons/merge`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          sourcePersonId,
          targetPersonId,
          actorOrgId,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Orchestrator merge HTTP ${res.status}`);
        return { globalPersonId: null };
      }
      const data = (await res.json()) as { globalPersonId?: string };
      return { globalPersonId: data.globalPersonId ?? null };
    } catch (e) {
      this.logger.warn(
        `Orchestrator merge failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { globalPersonId: null };
    }
  }
}
