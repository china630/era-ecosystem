import { cbarMode, assertLiveConfigured } from "../../integration/live-mode";

export type CkrSubmissionPayload = {
  bankOrgId: string;
  batchId: string;
  recordCount: number;
  records: Array<{
    loanId: string;
    customerId: string;
    status: string;
    effectiveDate: string;
  }>;
};

export type CkrValidationResult = {
  valid: boolean;
  batchId: string;
  errors: string[];
  provider: string;
  /** False for lab stub — never implies live CBAR/CKR acceptance. */
  submittedLive?: boolean;
};

export interface CreditRegistryAdapter {
  validateBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult>;
  submitBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult>;
}

/** Lab stub — schema checks only (P1-3). */
export class StubCreditRegistryAdapter implements CreditRegistryAdapter {
  async validateBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult> {
    const errors: string[] = [];
    if (!payload.batchId?.trim()) errors.push("batchId required");
    if (!payload.records?.length) errors.push("records required");
    for (const row of payload.records ?? []) {
      if (!row.loanId) errors.push("loanId missing in record");
      if (!row.customerId) errors.push("customerId missing in record");
      if (!row.status) errors.push("status missing in record");
    }
    return {
      valid: errors.length === 0,
      batchId: payload.batchId,
      errors,
      provider: "STUB_CKR",
    };
  }

  async submitBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult> {
    const validation = await this.validateBatch(payload);
    if (!validation.valid) return validation;
    // Lab only — must NOT look like a live CBAR/CKR acceptance.
    return {
      ...validation,
      provider: "STUB_CKR_LAB",
      submittedLive: false,
    };
  }
}

export class LiveCkrAdapter implements CreditRegistryAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async validateBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/ckr/validate`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        valid: false,
        batchId: payload.batchId,
        errors: [`HTTP ${res.status}`],
        provider: "CKR_LIVE",
      };
    }
    const data = (await res.json()) as CkrValidationResult;
    return { ...data, provider: "CKR_LIVE" };
  }

  async submitBatch(payload: CkrSubmissionPayload): Promise<CkrValidationResult> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/ckr/submit`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        valid: false,
        batchId: payload.batchId,
        errors: [`HTTP ${res.status}`],
        provider: "CKR_LIVE",
      };
    }
    return (await res.json()) as CkrValidationResult;
  }
}

export function createCreditRegistryAdapter(): CreditRegistryAdapter {
  const mode = cbarMode();
  if (mode === "stub") return new StubCreditRegistryAdapter();
  if (mode === "live") {
    assertLiveConfigured(
      mode,
      {
        BANK_CKR_BASE_URL: process.env.BANK_CKR_BASE_URL,
        BANK_CKR_API_KEY: process.env.BANK_CKR_API_KEY,
      },
      "BANK_CBAR_MODE=live",
    );
    return new LiveCkrAdapter(
      process.env.BANK_CKR_BASE_URL!.trim(),
      process.env.BANK_CKR_API_KEY!.trim(),
    );
  }
  return new StubCreditRegistryAdapter();
}