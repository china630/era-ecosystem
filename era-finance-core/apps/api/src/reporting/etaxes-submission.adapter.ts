/**
 * Seam for submitting e-taxes packages (VAT and future tax/customs/social)
 * via plain HTTP gateway or HSM-signed ASAN channel.
 *
 * Real HSM implementation lands when partner credentials are available;
 * until then HttpEtaxesSubmissionAdapter posts JSON to E_TAXES_VAT_SUBMIT_URL,
 * and HsmEtaxesSubmissionAdapter is selected only when ERA_ETAXES_HSM_ENABLED=1.
 */

/** Tax / social declaration channel destination (Wave 1 VAT + Wave 2 profit / payroll / DSMF). */
export type EtaxesSubmissionDestination =
  | "VAT"
  | "PROFIT_TAX"
  | "PAYROLL_WITHHOLDING"
  | "DSMF"
  | "EQAIME";

export type EtaxesSignerContext = {
  organizationId: string;
  /** Organization.settings.tax.asanUserId — ASAN subscriber / user id for HSM signing */
  asanUserId: string | null;
  destination: EtaxesSubmissionDestination;
};

export type EtaxesSubmissionResult = {
  submitted: boolean;
  gatewayStatus?: number;
  gatewayMessage?: string;
  signedPayloadHash?: string;
};

export interface EtaxesSubmissionAdapter {
  submit(
    payload: unknown,
    signer: EtaxesSignerContext,
  ): Promise<EtaxesSubmissionResult>;
}
