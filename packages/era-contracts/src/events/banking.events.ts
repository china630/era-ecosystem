import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_BANK_GL_DAILY_SUMMARY = "SATELLITE_BANK_GL_DAILY_SUMMARY" as const;
export const SATELLITE_BANK_ACCOUNT_OPENED = "SATELLITE_BANK_ACCOUNT_OPENED" as const;
export const SATELLITE_BANK_LOAN_DISBURSED = "SATELLITE_BANK_LOAN_DISBURSED" as const;
export const SATELLITE_BANK_PAYMENT_POSTED = "SATELLITE_BANK_PAYMENT_POSTED" as const;
export const SATELLITE_BANK_AML_ALERT_RAISED = "SATELLITE_BANK_AML_ALERT_RAISED" as const;
export const SATELLITE_BANK_REG_REPORT_EXPORTED = "SATELLITE_BANK_REG_REPORT_EXPORTED" as const;
export const SATELLITE_BANK_DBO_PAYMENT_SIGNED = "SATELLITE_BANK_DBO_PAYMENT_SIGNED" as const;
export const SATELLITE_BANK_CARD_ISSUED = "SATELLITE_BANK_CARD_ISSUED" as const;
export const SATELLITE_BANK_CARD_TXN_DECLINED = "SATELLITE_BANK_CARD_TXN_DECLINED" as const;
export const SATELLITE_BANK_TREASURY_GAP_SNAPSHOT = "SATELLITE_BANK_TREASURY_GAP_SNAPSHOT" as const;

const glLineSchema = z.object({
  glCode: z.string(),
  debit: z.number(),
  credit: z.number(),
});

export const satelliteBankGlDailySummarySchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_GL_DAILY_SUMMARY),
  payload: z.object({
    businessDate: z.string(),
    lines: z.array(glLineSchema),
    currency: z.literal("AZN"),
  }),
});

export const satelliteBankAccountOpenedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_ACCOUNT_OPENED),
  payload: z.object({
    accountId: z.string(),
    customerId: z.string(),
    iban: z.string(),
  }),
});

export const satelliteBankLoanDisbursedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_LOAN_DISBURSED),
  payload: z.object({
    loanId: z.string(),
    customerId: z.string(),
    amountMinor: z.number(),
    currency: z.string(),
  }),
});

export const satelliteBankPaymentPostedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_PAYMENT_POSTED),
  payload: z.object({
    paymentOrderId: z.string(),
    amountMinor: z.number(),
    currency: z.string(),
    rail: z.string(),
  }),
});

export const satelliteBankAmlAlertRaisedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_AML_ALERT_RAISED),
  payload: z.object({
    alertId: z.string(),
    ruleCode: z.string(),
    severity: z.string(),
  }),
});

export const satelliteBankRegReportExportedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_REG_REPORT_EXPORTED),
  payload: z.object({
    runId: z.string(),
    templateCode: z.string(),
    periodFrom: z.string(),
    periodTo: z.string(),
    format: z.enum(["csv", "xml", "json"]),
  }),
});

export const satelliteBankDboPaymentSignedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_DBO_PAYMENT_SIGNED),
  payload: z.object({
    paymentOrderId: z.string(),
    customerId: z.string(),
  }),
});

export const satelliteBankCardIssuedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_CARD_ISSUED),
  payload: z.object({
    cardId: z.string(),
    customerId: z.string(),
    panLast4: z.string(),
  }),
});

export const satelliteBankCardTxnDeclinedSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_CARD_TXN_DECLINED),
  payload: z.object({
    cardTxnId: z.string(),
    declineReason: z.string(),
    amountMinor: z.number(),
  }),
});

export const satelliteBankTreasuryGapSnapshotSchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_TREASURY_GAP_SNAPSHOT),
  payload: z.object({
    asOfDate: z.string(),
    horizonDays: z.number(),
  }),
});

export type SatelliteBankGlDailySummaryEvent = z.infer<typeof satelliteBankGlDailySummarySchema>;
export type SatelliteBankAccountOpenedEvent = z.infer<typeof satelliteBankAccountOpenedSchema>;
export type SatelliteBankLoanDisbursedEvent = z.infer<typeof satelliteBankLoanDisbursedSchema>;
export type SatelliteBankPaymentPostedEvent = z.infer<typeof satelliteBankPaymentPostedSchema>;
export type SatelliteBankAmlAlertRaisedEvent = z.infer<typeof satelliteBankAmlAlertRaisedSchema>;
export type SatelliteBankRegReportExportedEvent = z.infer<typeof satelliteBankRegReportExportedSchema>;
export type SatelliteBankDboPaymentSignedEvent = z.infer<typeof satelliteBankDboPaymentSignedSchema>;
export type SatelliteBankCardIssuedEvent = z.infer<typeof satelliteBankCardIssuedSchema>;
export type SatelliteBankCardTxnDeclinedEvent = z.infer<typeof satelliteBankCardTxnDeclinedSchema>;
export type SatelliteBankTreasuryGapSnapshotEvent = z.infer<typeof satelliteBankTreasuryGapSnapshotSchema>;

export function isSatelliteBankGlDailySummary(d: unknown): d is SatelliteBankGlDailySummaryEvent {
  return satelliteBankGlDailySummarySchema.safeParse(d).success;
}
export function isSatelliteBankAccountOpened(d: unknown): d is SatelliteBankAccountOpenedEvent {
  return satelliteBankAccountOpenedSchema.safeParse(d).success;
}
export function isSatelliteBankLoanDisbursed(d: unknown): d is SatelliteBankLoanDisbursedEvent {
  return satelliteBankLoanDisbursedSchema.safeParse(d).success;
}
export function isSatelliteBankPaymentPosted(d: unknown): d is SatelliteBankPaymentPostedEvent {
  return satelliteBankPaymentPostedSchema.safeParse(d).success;
}
export function isSatelliteBankAmlAlertRaised(d: unknown): d is SatelliteBankAmlAlertRaisedEvent {
  return satelliteBankAmlAlertRaisedSchema.safeParse(d).success;
}
export function isSatelliteBankRegReportExported(d: unknown): d is SatelliteBankRegReportExportedEvent {
  return satelliteBankRegReportExportedSchema.safeParse(d).success;
}
export function isSatelliteBankDboPaymentSigned(d: unknown): d is SatelliteBankDboPaymentSignedEvent {
  return satelliteBankDboPaymentSignedSchema.safeParse(d).success;
}
export function isSatelliteBankCardIssued(d: unknown): d is SatelliteBankCardIssuedEvent {
  return satelliteBankCardIssuedSchema.safeParse(d).success;
}
export function isSatelliteBankCardTxnDeclined(d: unknown): d is SatelliteBankCardTxnDeclinedEvent {
  return satelliteBankCardTxnDeclinedSchema.safeParse(d).success;
}
export function isSatelliteBankTreasuryGapSnapshot(d: unknown): d is SatelliteBankTreasuryGapSnapshotEvent {
  return satelliteBankTreasuryGapSnapshotSchema.safeParse(d).success;
}

export function isSatelliteBankEvent(d: unknown): boolean {
  return (
    isSatelliteBankGlDailySummary(d) ||
    isSatelliteBankAccountOpened(d) ||
    isSatelliteBankLoanDisbursed(d) ||
    isSatelliteBankPaymentPosted(d) ||
    isSatelliteBankAmlAlertRaised(d) ||
    isSatelliteBankRegReportExported(d) ||
    isSatelliteBankDboPaymentSigned(d) ||
    isSatelliteBankCardIssued(d) ||
    isSatelliteBankCardTxnDeclined(d) ||
    isSatelliteBankTreasuryGapSnapshot(d)
  );
}
