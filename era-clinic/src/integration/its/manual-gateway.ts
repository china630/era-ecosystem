/**
 * ITS / e-Tabib referral gateway stub (MED-P1-03).
 * Mode is driven by CLINIC_ITS_GATEWAY=disabled|manual|api (api not implemented).
 */

export type ItsGatewayMode = "disabled" | "manual" | "api";

export function itsGatewayMode(): ItsGatewayMode {
  const raw = (process.env.CLINIC_ITS_GATEWAY ?? "manual").trim().toLowerCase();
  if (raw === "disabled" || raw === "manual" || raw === "api") return raw;
  return "manual";
}

export type ManualReferralValidateInput = {
  referralCode: string;
  issuedAt: Date;
  expiresAt?: Date | null;
};

export type ManualReferralValidateResult =
  | { ok: true; allowedServiceCodes: string[] }
  | { ok: false; code: "ITS_DISABLED" | "REFERRAL_EXPIRED" | "REFERRAL_INVALID" };

export function validateManualReferral(input: ManualReferralValidateInput): ManualReferralValidateResult {
  if (itsGatewayMode() === "disabled") {
    return { ok: false, code: "ITS_DISABLED" };
  }
  const code = input.referralCode.trim();
  if (code.length < 4) {
    return { ok: false, code: "REFERRAL_INVALID" };
  }
  if (input.expiresAt && input.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: "REFERRAL_EXPIRED" };
  }
  return { ok: true, allowedServiceCodes: [] };
}