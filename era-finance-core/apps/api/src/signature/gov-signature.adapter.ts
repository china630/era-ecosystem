import type { SignatureProvider } from "@erafinance/database";

export type GovSignaturePurpose =
  | "INVOICE"
  | "TAX_DECLARATION"
  | "EQAIME"
  | "RECONCILIATION";

export type GovSignatureOptions = {
  organizationId: string;
  asanUserId?: string | null;
  purpose: GovSignaturePurpose;
  provider?: SignatureProvider;
};

export type GovSignatureResult = {
  signatureId: string;
  signedAt: Date;
  provider: SignatureProvider;
  certificateThumbprint?: string;
  certificateSubject?: string;
  certificateIssuer?: string;
};

export interface GovSignatureAdapter {
  signPayload(
    payload: Buffer | string,
    opts: GovSignatureOptions,
  ): Promise<GovSignatureResult>;
}
