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

/** Cybernet KKM HTTP bridge — device.endpoint preferred over ERA_FISCAL_CYBERNET_URL. */
export class CybernetFiscalDriverHttp extends PartialFiscalDriver {
  readonly name = "cybernet";
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
      process.env.ERA_FISCAL_CYBERNET_URL?.trim() ||
      undefined
    );
  }

  private token(): string | undefined {
    return (
      this.deviceToken ||
      process.env.ERA_FISCAL_CYBERNET_TOKEN?.trim() ||
      undefined
    );
  }

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const base = this.baseUrl();
    if (!base) {
      const id = `CYB-STUB-${Date.now()}`;
      return {
        receiptId: id,
        qrPayload: `cybernet://stub/${id}`,
        driver: "cybernet-stub-fallback",
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
      throw new Error(`Cybernet fiscalize failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    const receiptId = json.receiptId ?? `CYB-${Date.now()}`;
    return {
      receiptId,
      qrPayload: json.qrPayload ?? `cybernet://${receiptId}`,
      driver: "cybernet-http",
    };
  }

  async sale(input: SaleInput & { fiscalDeviceId: string }): Promise<SaleResult> {
    return super.sale(input);
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
      }),
    });
    if (!res.ok) {
      throw new Error(`Cybernet refund failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      receiptId?: string;
      qrPayload?: string;
    };
    return {
      receiptId: json.receiptId ?? `CYB-R-${Date.now()}`,
      qrPayload: json.qrPayload ?? null,
      driver: "cybernet-http",
      fiscalDeviceId: input.fiscalDeviceId,
    };
  }

  async openShift(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.baseUrl();
    if (!base) return super.openShift(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`Cybernet openShift failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `CYB-OPEN-${Date.now()}`,
      driver: "cybernet-http",
    };
  }

  async zReport(input: DeviceShiftInput): Promise<DeviceReportResult> {
    const base = this.baseUrl();
    if (!base) return super.zReport(input);
    const res = await fetch(`${base.replace(/\/$/, "")}/shift/z`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalDeviceId: input.fiscalDeviceId }),
    });
    if (!res.ok) throw new Error(`Cybernet zReport failed ${res.status}`);
    const json = (await res.json()) as { reportId?: string };
    return {
      reportId: json.reportId ?? `CYB-Z-${Date.now()}`,
      driver: "cybernet-http",
    };
  }
}
