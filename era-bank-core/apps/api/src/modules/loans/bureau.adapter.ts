import {
  akbMode,
  assertLiveConfigured,
} from "../../integration/live-mode";

export type BureauReport = {
  score: number;
  reportId: string;
  provider: string;
  pulledAt: string;
};

export type BureauFullReport = BureauReport & {
  obligations?: Array<{ lender: string; outstandingMinor: string }>;
  inquiriesLast12m?: number;
};

export type CreditHistorySubmission = {
  bankOrgId: string;
  batchId: string;
  subjectConsentRef: string;
  records: Array<{
    customerId: string;
    loanId: string;
    status: string;
    outstandingMinor: string;
    effectiveDate: string;
  }>;
};

export type CreditHistorySubmissionResult = {
  accepted: boolean;
  batchId: string;
  provider: string;
  message?: string;
};

export interface CreditBureauAdapter {
  pullScore(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef?: string;
  }): Promise<BureauReport>;
  pullReport(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef: string;
  }): Promise<BureauFullReport>;
  submitCreditHistory(
    batch: CreditHistorySubmission,
  ): Promise<CreditHistorySubmissionResult>;
}

/** Dev/lab stub bureau. */
export class StubCreditBureauAdapter implements CreditBureauAdapter {
  async pullScore(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef?: string;
  }): Promise<BureauReport> {
    const hash = [...input.customerId].reduce((a, c) => a + c.charCodeAt(0), 0);
    const score = 550 + (hash % 250);
    return {
      score,
      reportId: `stub-akb-${input.customerId.slice(0, 8)}-${Date.now()}`,
      provider: "STUB_AKB",
      pulledAt: new Date().toISOString(),
    };
  }

  async pullReport(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef: string;
  }): Promise<BureauFullReport> {
    const base = await this.pullScore(input);
    return {
      ...base,
      obligations: [
        {
          lender: "STUB_BANK",
          outstandingMinor: "0",
        },
      ],
      inquiriesLast12m: 1,
    };
  }

  async submitCreditHistory(
    batch: CreditHistorySubmission,
  ): Promise<CreditHistorySubmissionResult> {
    if (!batch.subjectConsentRef?.trim()) {
      return {
        accepted: false,
        batchId: batch.batchId,
        provider: "STUB_AKB",
        message: "subjectConsentRef required",
      };
    }
    return {
      accepted: batch.records.length > 0,
      batchId: batch.batchId,
      provider: "STUB_AKB_BATCH",
    };
  }
}

/**
 * Live AKB connector behind BANK_BUREAU_MODE=live.
 * Fail-closed when live mode is selected but base URL / API key missing.
 */
export class LiveAkbAdapter implements CreditBureauAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async pullScore(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef?: string;
  }): Promise<BureauReport> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/score`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          customerId: input.customerId,
          bankOrgId: input.bankOrgId,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`AKB HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        score?: number;
        reportId?: string;
      };
      if (typeof data.score !== "number" || !data.reportId) {
        throw new Error("AKB response missing score/reportId");
      }
      return {
        score: data.score,
        reportId: data.reportId,
        provider: "AKB_LIVE",
        pulledAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async pullReport(input: {
    customerId: string;
    bankOrgId: string;
    subjectConsentRef: string;
  }): Promise<BureauFullReport> {
    const base = await this.pullScore(input);
    return {
      ...base,
      provider: "AKB_LIVE_REPORT",
    };
  }

  async submitCreditHistory(
    batch: CreditHistorySubmission,
  ): Promise<CreditHistorySubmissionResult> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/credit-history`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      return {
        accepted: false,
        batchId: batch.batchId,
        provider: "AKB_LIVE",
        message: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { accepted?: boolean };
    return {
      accepted: data.accepted === true,
      batchId: batch.batchId,
      provider: "AKB_LIVE",
    };
  }
}

export function createCreditBureauAdapter(): CreditBureauAdapter {
  const mode = akbMode();
  if (
    mode === "stub" ||
    process.env.BANK_BUREAU_STUB === "true"
  ) {
    return new StubCreditBureauAdapter();
  }

  if (mode === "live") {
    assertLiveConfigured(
      mode,
      {
        BANK_AKB_BASE_URL: process.env.BANK_AKB_BASE_URL,
        BANK_AKB_API_KEY: process.env.BANK_AKB_API_KEY,
      },
      "BANK_BUREAU_MODE=live",
    );
    const baseUrl = process.env.BANK_AKB_BASE_URL!.trim();
    const apiKey = process.env.BANK_AKB_API_KEY!.trim();
    const timeoutMs = Number(process.env.BANK_AKB_TIMEOUT_MS ?? "5000");
    return new LiveAkbAdapter(
      baseUrl,
      apiKey,
      Number.isFinite(timeoutMs) ? timeoutMs : 5000,
    );
  }

  return new StubCreditBureauAdapter();
}
