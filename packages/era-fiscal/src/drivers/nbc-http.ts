import type { FiscalDriver, FiscalizeInput, FiscalizeResult } from "../types";

/**
 * Production NBC driver — HTTP bridge to local fiscal device or middleware.
 * Set ERA_FISCAL_NBC_URL (e.g. http://127.0.0.1:8088/fiscalize).
 * Falls back to stub response when URL unreachable (dev).
 */
export class NbcFiscalDriverHttp implements FiscalDriver {
  readonly name = "nbc";

  async fiscalize(input: FiscalizeInput): Promise<FiscalizeResult> {
    const base = process.env.ERA_FISCAL_NBC_URL?.trim();
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
        ...(process.env.ERA_FISCAL_NBC_TOKEN
          ? { Authorization: `Bearer ${process.env.ERA_FISCAL_NBC_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        documentRef: input.documentRef,
        amount: input.amount,
        currency: input.currency ?? "AZN",
        paymentMethod: input.paymentMethod,
        registerRef: input.registerRef,
        outletCode: input.outletCode,
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
}
