/**
 * Seam for ƏMAS (e-müqavilə) S2S contract lifecycle via HTTP gateway or HSM/ASAN.
 */

export type EmasSignerContext = {
  organizationId: string;
  /** Organization.settings.tax.asanUserId — ASAN subscriber id for HSM signing */
  asanUserId: string | null;
};

export type EmasSubmissionResult = {
  submitted: boolean;
  externalId?: string | null;
  gatewayStatus?: number;
  gatewayMessage?: string;
  signedPayloadHash?: string;
};

export interface EmasSubmissionAdapter {
  submitHire(
    payload: unknown,
    signer: EmasSignerContext,
  ): Promise<EmasSubmissionResult>;
  submitTransfer(
    payload: unknown,
    signer: EmasSignerContext,
  ): Promise<EmasSubmissionResult>;
  submitTerminate(
    payload: unknown,
    signer: EmasSignerContext,
  ): Promise<EmasSubmissionResult>;
}
