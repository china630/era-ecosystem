import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";

export type NetworkDocumentDeliverPayload = {
  correlationId: string;
  issuerOrganizationId: string;
  recipientOrganizationId: string;
  sourceInvoiceId: string;
  currency: string;
  totalNet: string;
  vatAmount: string;
  totalGross: string;
  lines: unknown;
  issuerInvoiceNumber?: string | null;
  issuerTaxIdBlindIndex?: string | null;
  targetFinanceBaseUrl?: string | null;
};

@Injectable()
export class NetworkDocumentsService {
  private readonly logger = new Logger(NetworkDocumentsService.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly config: ConfigService,
  ) {}

  async deliver(payload: NetworkDocumentDeliverPayload) {
    const baseUrl = (
      payload.targetFinanceBaseUrl?.trim() ||
      (await this.resolveFinanceBaseUrl(payload.recipientOrganizationId)) ||
      this.config.get<string>("ERA_FINANCE_API_INTERNAL_URL") ||
      "http://127.0.0.1:4100"
    ).replace(/\/$/, "");

    const token =
      this.config.get<string>("FINANCE_INTERNAL_SERVICE_TOKEN")?.trim() ?? "";
    const res = await fetch(`${baseUrl}/internal/v1/network-documents/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(
        `Network deliver failed ${res.status} → ${baseUrl}: ${text.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException(
        `Finance receive failed: ${res.status}`,
      );
    }
    return text ? (JSON.parse(text) as unknown) : { ok: true };
  }

  private async resolveFinanceBaseUrl(organizationId: string): Promise<string | null> {
    const org = await this.controlPlane.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org?.settings || typeof org.settings !== "object" || Array.isArray(org.settings)) {
      return null;
    }
    const s = org.settings as Record<string, unknown>;
    const direct = s.financeApiBaseUrl;
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }
    const nd = s.networkDocuments;
    if (nd && typeof nd === "object" && !Array.isArray(nd)) {
      const url = (nd as Record<string, unknown>).financeApiBaseUrl;
      if (typeof url === "string" && url.trim()) {
        return url.trim();
      }
    }
    return null;
  }
}
