import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  NetworkDocumentPayload,
  NetworkDocumentTransport,
} from "./network-document-transport";
import {
  resolveControlPlaneServiceToken,
  resolveOrchestratorInternalUrl,
} from "../../control-plane/control-plane-credentials";

@Injectable()
export class OrchestratorNetworkDocumentTransport implements NetworkDocumentTransport {
  private readonly logger = new Logger(OrchestratorNetworkDocumentTransport.name);

  constructor(private readonly config: ConfigService) {}

  async deliver(payload: NetworkDocumentPayload): Promise<void> {
    // Runtime-config memory first (kit); CONTROL_PLANE_URL env = bootstrap only.
    const baseUrl = (
      resolveOrchestratorInternalUrl(this.config) || "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    const token =
      resolveControlPlaneServiceToken(this.config) ||
      this.config.get<string>("ORCHESTRATOR_SERVICE_TOKEN")?.trim() ||
      "";
    if (!token) {
      this.logger.warn("ORCHESTRATOR_SERVICE_TOKEN / CONTROL_PLANE_SERVICE_TOKEN missing; cannot deliver network doc");
      return;
    }
    const res = await fetch(`${baseUrl}/internal/v1/network-documents/deliver`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Orchestrator network deliver failed ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  }
}
