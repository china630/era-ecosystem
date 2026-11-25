/**
 * FMN (SFm) report export abstraction — stub schema today, XSD-shaped layout for a future regulator drop-in.
 */

export type FmnFilingQueueStatus = "QUEUED" | "READY_TO_FILE" | "EXPORTED" | "FILED";

export type FmnFilingQueueItem = {
  status: FmnFilingQueueStatus;
  filingDeadline: string;
  businessDaysAfterTxn: number;
  alertIds: string[];
};

export type FmnSuspiciousTransaction = {
  alertId: string;
  ruleCode: string;
  transactionId: string | null;
  customerId: string | null;
  amountMinor: string | null;
  currency: string | null;
  narrative: string;
  screeningHitCount: number;
  filingDeadline?: string;
  txnObservedAt?: string;
};

export type FmnReportDocument = {
  schemaVersion: string;
  institutionMfo: string;
  reportType: string;
  periodFrom: string;
  periodTo: string;
  listVersion?: string;
  generatedAt: string;
  suspiciousTransactions: FmnSuspiciousTransaction[];
  filingQueue?: FmnFilingQueueItem;
};

export type FmnReportBuildInput = {
  institutionMfo: string;
  periodFrom: Date;
  periodTo: Date;
  listVersion?: string;
  suspiciousTransactions: FmnSuspiciousTransaction[];
  filingQueue?: FmnFilingQueueItem;
};

export interface FmnReportFormatter {
  readonly schemaVersion: string;
  buildDocument(input: FmnReportBuildInput): FmnReportDocument;
  formatJson(document: FmnReportDocument): string;
  formatXml(document: FmnReportDocument): string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Current test stub — richer than legacy 4-field XML; maps to a future FMN XSD envelope. */
export class FmnReportFormatterV1Stub implements FmnReportFormatter {
  readonly schemaVersion = "FMN-TEST-1";

  buildDocument(input: FmnReportBuildInput): FmnReportDocument {
    return {
      schemaVersion: this.schemaVersion,
      institutionMfo: input.institutionMfo,
      reportType: "SUSPICIOUS_TRANSACTION",
      periodFrom: input.periodFrom.toISOString(),
      periodTo: input.periodTo.toISOString(),
      listVersion: input.listVersion ?? "sanctions-seed-v1",
      generatedAt: new Date().toISOString(),
      suspiciousTransactions: input.suspiciousTransactions,
      filingQueue: input.filingQueue,
    };
  }

  formatJson(document: FmnReportDocument): string {
    return JSON.stringify(document, null, 2);
  }

  formatXml(document: FmnReportDocument): string {
    const txRows = document.suspiciousTransactions
      .map(
        (tx) => `    <suspiciousTransaction>
      <alertId>${escapeXml(tx.alertId)}</alertId>
      <ruleCode>${escapeXml(tx.ruleCode)}</ruleCode>
      <transactionId>${escapeXml(tx.transactionId ?? "")}</transactionId>
      <amountMinor>${escapeXml(tx.amountMinor ?? "")}</amountMinor>
      <currency>${escapeXml(tx.currency ?? "")}</currency>
      <narrative>${escapeXml(tx.narrative)}</narrative>
      <filingDeadline>${escapeXml(tx.filingDeadline ?? "")}</filingDeadline>
    </suspiciousTransaction>`,
      )
      .join("\n");

    const queue = document.filingQueue;
    const queueXml = queue
      ? `  <filingQueue>
    <status>${escapeXml(queue.status)}</status>
    <filingDeadline>${escapeXml(queue.filingDeadline)}</filingDeadline>
    <businessDaysAfterTxn>${queue.businessDaysAfterTxn}</businessDaysAfterTxn>
  </filingQueue>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<fmnReport schemaVersion="${escapeXml(document.schemaVersion)}">
  <header>
    <institutionMfo>${escapeXml(document.institutionMfo)}</institutionMfo>
    <reportType>${escapeXml(document.reportType)}</reportType>
    <periodFrom>${escapeXml(document.periodFrom)}</periodFrom>
    <periodTo>${escapeXml(document.periodTo)}</periodTo>
    <generatedAt>${escapeXml(document.generatedAt)}</generatedAt>
  </header>
${queueXml}
  <suspiciousTransactions>
${txRows}
  </suspiciousTransactions>
</fmnReport>`;
  }
}

const FORMATTERS: FmnReportFormatter[] = [new FmnReportFormatterV1Stub()];

export function resolveFmnFormatter(schemaVersion?: string): FmnReportFormatter {
  if (schemaVersion) {
    const match = FORMATTERS.find((f) => f.schemaVersion === schemaVersion);
    if (match) return match;
  }
  return FORMATTERS[0];
}