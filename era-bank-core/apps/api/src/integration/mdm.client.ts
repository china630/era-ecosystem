import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

export type MdmResolveInput = {
  fin?: string;
  passportNumber?: string;
  passport?: string;
  issuingCountry?: string;
  email?: string;
  fullName?: string;
};

export type MdmResolveResult = {
  globalPersonId: string;
  source: "mdm" | "stub";
};

@Injectable()
export class MdmClient {
  private readonly logger = new Logger(MdmClient.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly mdmRequired: boolean;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>("CONTROL_PLANE_URL")?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";
    this.token =
      config.get<string>("ORCHESTRATOR_INTERNAL_SERVICE_TOKEN") ??
      config.get<string>("CONTROL_PLANE_SERVICE_TOKEN") ??
      "";
    this.mdmRequired = config.get<string>("MDM_REQUIRED") === "true";
  }

  /** Resolve person in MDM; stub only when MDM_REQUIRED=false. */
  async resolvePerson(input: MdmResolveInput): Promise<MdmResolveResult> {
    const body = {
      fin: input.fin,
      passport: input.passport ?? input.passportNumber,
      issuingCountry: input.issuingCountry,
      fullName: input.fullName ?? "Unknown",
    };
    if (!this.token) {
      if (this.mdmRequired) {
        throw new Error("MDM_REQUIRED but ORCHESTRATOR service token missing");
      }
      return {
        globalPersonId: `stub-person-${input.fin ?? input.passport ?? Date.now()}`,
        source: "stub",
      };
    }
    try {
      const res = await axios.post(`${this.baseUrl}/internal/v1/mdm/persons/resolve`, body, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 5000,
        validateStatus: () => true,
      });
      if (res.status === 200 || res.status === 201) {
        const id = res.data?.globalPersonId ?? res.data?.id;
        if (id) return { globalPersonId: String(id), source: "mdm" };
      }
    } catch (err) {
      this.logger.warn(`MDM resolve failed: ${(err as Error).message}`);
    }
    if (this.mdmRequired) {
      throw new Error("MDM resolve failed and MDM_REQUIRED=true");
    }
    return {
      globalPersonId: `stub-person-${input.fin ?? input.passport ?? Date.now()}`,
      source: "stub",
    };
  }
}
