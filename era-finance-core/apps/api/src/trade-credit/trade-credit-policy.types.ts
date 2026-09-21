export type TradeCreditPolicyGroupCode = "A" | "B" | "C" | "D";

export type TradeCreditProposedKindCode =
  | "WORKING_CAPITAL"
  | "TRIAL"
  | "RESTORE"
  | "ENRICH_HAIRCUT"
  | "A_RAISE";

export type TradeCreditFeatureSnapshot = {
  maxDpd: number;
  avgDpd: number;
  /** Amount-weighted open AR DPD (Phase 3). */
  weightedAvgDpd: number;
  overdueShare: number;
  partialPayRatio: number;
  turnoverTrend: number; // last90/prev90 - 1 (negative = falling)
  /** YoY same-90d when prior year revenue exists; else null. */
  turnoverTrendYoy: number | null;
  utilization: number;
  paidInvoiceCount: number;
  openAr: number;
  creditLimit: number;
  maxOpenRemainder: number;
  concentration: number;
  recognizedLast90: number;
  recognizedSame90LastYear: number;
  paymentTermsDays: number;
  /** Phase 2b optional enrich signals (finance-only); null when stale/unknown. */
  riskyTaxpayer?: boolean | null;
  voenInactive?: boolean | null;
  enrichAt?: string | null;
  enrichStale?: boolean;
};

export type TradeCreditClassifyResult = {
  group: TradeCreditPolicyGroupCode | null;
  reasons: string[];
  features: TradeCreditFeatureSnapshot;
  thinHistory: boolean;
};

export type OrgTradeCreditPolicyDefaults = {
  autoRaiseEnabled: boolean;
  autoDMaxDpd: number;
  autoRaisePct: number;
  autoRaiseCapAzn: number | null;
  grantTtlHoursA: number;
  grantTtlHoursB: number;
  grantTtlHoursC: number;
  groupCRequireConfirm: boolean;
  minPaidInvoices: number;
  /** When true, latest enrich riskyTaxpayer → hard D (default false = informational). */
  enrichRiskyForcesD: boolean;
  enrichVoenInactiveForcesD: boolean;
  /** Phase 3 working-capital knobs. */
  limitK: number;
  trialLimitAzn: number;
  suggestedCapAzn: number | null;
  groupMultB: number;
  groupMultC: number;
  partialPayHaircut: number;
  partialPayThreshold: number;
  concentrationHaircut: number;
  concentrationThreshold: number;
  enrichTtlDays: number;
  enrichHaircut: number;
  restoreProposalEnabled: boolean;
};

export const DEFAULT_ORG_TRADE_CREDIT_POLICY: OrgTradeCreditPolicyDefaults = {
  autoRaiseEnabled: false,
  autoDMaxDpd: 90,
  autoRaisePct: 20,
  autoRaiseCapAzn: null,
  grantTtlHoursA: 24,
  grantTtlHoursB: 24,
  grantTtlHoursC: 8,
  groupCRequireConfirm: false,
  minPaidInvoices: 3,
  enrichRiskyForcesD: false,
  enrichVoenInactiveForcesD: false,
  limitK: 1,
  trialLimitAzn: 500,
  suggestedCapAzn: null,
  groupMultB: 0.5,
  groupMultC: 0.3,
  partialPayHaircut: 0.8,
  partialPayThreshold: 0.3,
  concentrationHaircut: 0.7,
  concentrationThreshold: 0.8,
  enrichTtlDays: 90,
  enrichHaircut: 0.5,
  restoreProposalEnabled: true,
};
