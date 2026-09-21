import type {
  FiscalizeInput,
  FiscalizeResult,
  SaleInput,
  SaleResult,
  RefundInput,
  DeviceShiftInput,
  DeviceReportResult,
} from "../types";
import { PartialFiscalDriver } from "./partial";

/**
 * Omnitech KKM driver (F4). Talks to a local/cloud HTTP agent.
 * Device.endpoint preferred; env ERA_FISCAL_OMNITECH_URL as install fallback.
 * Vendor SDK, if any, stays private to this module — satellites never import it.
 */
export class OmnitechFiscalDriver extends PartialFiscalDriver {
  readonly name = "omnitech";
  private deviceEndpoint: string | null = null;
  private deviceToken: string | null = null;

  setEndpoint(url: string): void {
    this.deviceEndpoint = url.trim() || null;
  }

  setAuthToken(token: string): void {
    this.deviceToken = token.trim() || null;
  }

  private baseUrl(): string | undefined {
    return (
      this.deviceEndpoint ||
      process.env.ERA_FISCAL_OMNITECH_URL?.trim() ||
      undefined
    );
  }

  private token(): string | undefined {
    return (
      this.deviceToken ||
      process.env.ERA_FISCAL_OMNITECH_TOKEN?.trim() ||
      undefined
    );
  }

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const base = this.baseUrl();
    if (!base) {
      // Lab without agent: synthetic receipt (still provider omnitech for wiring tests).
      const id = `OMNI-${Date.now()}`;
      return {
        receiptId: id,
        qrPayload: `omnitech://receipt/${id}?amt=${input.amount}`,
        driver: "omnitech-stub",
      };
    }

    const res = await fetch(`${base.replace(/\/$/, "")}/fiscalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: `Bearer ${this.token()}` } : {}),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        amount: input.amount,
        currency: input.currency ?? "AZN",
        paymentMethod: input.paymentMethod,
        lines: input.lines,
        registerRef: input.registerRef,
        outletCode: input.outletCode,
        metadata: input.metadata,
      }),
    });
    if (!res.ok) {
      throw new Error(`Omnitech fiscalize failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    const receiptId = json.receiptId ?? `OMNI-${Date.now()}`;
    return {
      receiptId,
      qrPayload: json.qrPayload ?? `omnitech://${receiptId}`,
      driver: "omnitech-http",
    };
  }

  async sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult> {
    const base = this.baseUrl();
    if (!base) return super.sale(input);

    const res = await fetch(`${base.replace(/\/$/, "")}/sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: `Bearer ${this.token()}` } : {}),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        fiscalDeviceId: input.fiscalDeviceId,
        lines: input.lines,
        tenders: input.tenders,
        currency: input.currency ?? "AZN",
        outletCode: input.outletCode,
        registerRef: input.registerRef,
        metadata: input.metadata,
      }),
    });
    if (!res.ok) {
      throw new Error(`Omnitech sale failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    return {
      receiptId: json.receiptId ?? `OMNI-${Date.now()}`,
      qrPayload: json.qrPayload ?? null,
      driver: "omnitech-http",
      fiscalDeviceId: input.fiscalDeviceId,
      bankTerminalId: input.bankTerminalId ?? null,
    };
  }

  async refund(
    input: RefundInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    const base = this.baseUrl();
    if (!base) return super.refund(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: `Bearer ${this.token()}` } : {}),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        originalReceiptId: input.originalReceiptId,
        amount: input.amount,
        fiscalDeviceId: input.fiscalDeviceId,
        reason: input.reason,
      }),
    });
    if (!res.ok) {
      throw new Error(`Omnitech refund failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    return {
      receiptId: json.receiptId ?? `OMNI-R-${Date.now()}`,
      qrPayload: json.qrPayload ?? null,
      driver: "omnitech-http",
      fiscalDeviceId: input.fiscalDeviceId,
    };
  }

  async openShift(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.baseUrl();
    if (!base) return super.openShift(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: `Bearer ${this.token()}` } : {}),
      },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`Omnitech openShift failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `OMNI-OPEN-${Date.now()}`,
      driver: "omnitech-http",
    };
  }

  async zReport(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.baseUrl();
    if (!base) return super.zReport(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/z`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: `Bearer ${this.token()}` } : {}),
      },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`Omnitech zReport failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `OMNI-Z-${Date.now()}`,
      driver: "omnitech-http",
    };
  }
}
