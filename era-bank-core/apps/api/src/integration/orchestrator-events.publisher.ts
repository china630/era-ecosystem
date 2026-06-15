import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import {
  SATELLITE_BANK_AML_ALERT_RAISED,
  SATELLITE_BANK_CARD_ISSUED,
  SATELLITE_BANK_CARD_TXN_DECLINED,
  SATELLITE_BANK_DBO_PAYMENT_SIGNED,
  SATELLITE_BANK_GL_DAILY_SUMMARY,
  SATELLITE_BANK_REG_REPORT_EXPORTED,
  SATELLITE_BANK_TREASURY_GAP_SNAPSHOT,
} from "@era/contracts";

@Injectable()
export class OrchestratorEventsPublisher {
  private readonly logger = new Logger(OrchestratorEventsPublisher.name);
  private readonly gatewayUrl: string;
  private readonly token: string;
  private readonly organizationId: string;

  constructor(config: ConfigService) {
    this.gatewayUrl =
      config.get<string>("CONTROL_PLANE_URL")?.replace(/\/$/, "") ??
      "http://127.0.0.1:4000";
    this.token = config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN") ?? "";
    this.organizationId = config.get<string>("ERA_BANK_ORGANIZATION_ID") ?? "";
  }

  async publishGlDailySummary(payload: {
    businessDate: string;
    lines: Array<{ glCode: string; debit: number; credit: number }>;
  }) {
    if (!this.token) {
      this.logger.debug("SATELLITE_EVENT_SERVICE_TOKEN not set; skip publish");
      return { skipped: true };
    }
    const envelope = {
      type: SATELLITE_BANK_GL_DAILY_SUMMARY,
      organizationId: this.organizationId,
      satelliteKey: "bank_core",
      occurredAt: new Date().toISOString(),
      payload: { ...payload, currency: "AZN" as const },
    };
    try {
      await axios.post(`${this.gatewayUrl}/api/v1/satellite-events`, envelope, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 5000,
        validateStatus: () => true,
      });
      return { published: true, eventId: envelope.occurredAt };
    } catch (err) {
      this.logger.warn(`orchestrator publish failed: ${(err as Error).message}`);
      return { published: false };
    }
  }

  async publishAmlAlertRaised(payload: {
    alertId: string;
    ruleCode: string;
    severity: string;
  }) {
    return this.publishEnvelope(SATELLITE_BANK_AML_ALERT_RAISED, payload);
  }

  async publishRegReportExported(payload: {
    runId: string;
    templateCode: string;
    periodFrom: string;
    periodTo: string;
    format: "csv" | "xml" | "json";
  }) {
    return this.publishEnvelope(SATELLITE_BANK_REG_REPORT_EXPORTED, payload);
  }

  async publishDboPaymentSigned(payload: {
    paymentOrderId: string;
    customerId: string;
    asanTransactionId?: string;
  }) {
    return this.publishEnvelope(SATELLITE_BANK_DBO_PAYMENT_SIGNED, payload);
  }

  async publishCardIssued(payload: { cardId: string; customerId: string; panLast4: string }) {
    return this.publishEnvelope(SATELLITE_BANK_CARD_ISSUED, payload);
  }

  async publishCardTxnDeclined(payload: {
    cardTxnId: string;
    declineReason: string;
    amountMinor: number;
  }) {
    return this.publishEnvelope(SATELLITE_BANK_CARD_TXN_DECLINED, payload);
  }

  async publishTreasuryGapSnapshot(payload: {
    snapshotId: string;
    asOfDate: string;
    horizonDays: number;
    lcrRatioStub: number | null;
  }) {
    return this.publishEnvelope(SATELLITE_BANK_TREASURY_GAP_SNAPSHOT, payload);
  }

  private async publishEnvelope(type: string, payload: Record<string, unknown>) {
    if (!this.token) {
      this.logger.debug("SATELLITE_EVENT_SERVICE_TOKEN not set; skip publish");
      return { skipped: true };
    }
    const envelope = {
      type,
      organizationId: this.organizationId,
      satelliteKey: "bank_core",
      occurredAt: new Date().toISOString(),
      payload,
    };
    try {
      await axios.post(`${this.gatewayUrl}/api/v1/satellite-events`, envelope, {
        headers: { Authorization: `Bearer ${this.token}` },
        timeout: 5000,
        validateStatus: () => true,
      });
      return { published: true };
    } catch (err) {
      this.logger.warn(`orchestrator publish failed: ${(err as Error).message}`);
      return { published: false };
    }
  }
}
