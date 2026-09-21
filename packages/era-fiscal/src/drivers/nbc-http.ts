import type {
  FiscalizeInput,
  FiscalizeResult,
  RefundInput,
  SaleInput,
  SaleResult,
  DeviceShiftInput,
  DeviceReportResult,
} from "../types";
import { PartialFiscalDriver } from "./partial";

/**
 * Production NBC driver — HTTP bridge to local fiscal device or middleware.
 * Device endpoint preferred (F2+); falls back to ERA_FISCAL_NBC_URL.
 */
export class NbcFiscalDriverHttp extends PartialFiscalDriver {
  readonly name = "nbc";
  private deviceEndpoint: string | null = null;
  private deviceToken: string | null = null;

  setEndpoint(url: string): void {
    this.deviceEndpoint = url.trim() || null;
  }

  setAuthToken(token: string): void {
    this.deviceToken = token.trim() || null;
  }

  private authHeaders(): Record<string, string> {
    const token =
      this.deviceToken || process.env.ERA_FISCAL_NBC_TOKEN?.trim() || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private endpoint(deviceEndpoint?: string | null): string | undefined {
    return (
      deviceEndpoint?.trim() ||
      this.deviceEndpoint ||
      process.env.ERA_FISCAL_NBC_URL?.trim() ||
      undefined
    );
  }

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const base = this.endpoint();
    if (!base) {
      const id = `NBC-STUB-${Date.now()}`;
      return {
        receiptId: id,
        qrPayload: `nbc://stub/${id}?amt=${input.amount}`,
        driver: "nbc-stub-fallback",
      };
    }

    const url = base.replace(/\/$/, "");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        amount: input.amount,
        currency: input.currency ?? "AZN",
        paymentMethod: input.paymentMethod,
        registerRef: input.registerRef,
        outletCode: input.outletCode,
        lines: input.lines,
        metadata: input.metadata,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NBC fiscalize failed ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      receiptId?: string;
      fiscalNumber?: string;
      qrPayload?: string;
    };

    const receiptId = json.receiptId ?? json.fiscalNumber ?? `NBC-${Date.now()}`;
    return {
      receiptId,
      qrPayload: json.qrPayload ?? `nbc://${receiptId}`,
      driver: "nbc-http",
    };
  }

  async sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult> {
    return super.sale(input);
  }

  async refund(
    input: RefundInput & { fiscalDeviceId: string },
  ): Promise<SaleResult> {
    const base = this.endpoint();
    if (!base) return super.refund(input);
    const url = `${base.replace(/\/$/, "")}/refund`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        originalReceiptId: input.originalReceiptId,
        amount: input.amount,
        reason: input.reason,
      }),
    });
    if (!res.ok) {
      throw new Error(`NBC refund failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    return {
      receiptId: json.receiptId ?? `NBC-R-${Date.now()}`,
      qrPayload: json.qrPayload ?? null,
      driver: "nbc-http",
      fiscalDeviceId: input.fiscalDeviceId,
    };
  }

  async openShift(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.endpoint();
    if (!base) return super.openShift(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`NBC openShift failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `NBC-OPEN-${Date.now()}`,
      driver: "nbc-http",
    };
  }

  async zReport(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.endpoint();
    if (!base) return super.zReport(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/z`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`NBC zReport failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `NBC-Z-${Date.now()}`,
      driver: "nbc-http",
    };
  }
}
