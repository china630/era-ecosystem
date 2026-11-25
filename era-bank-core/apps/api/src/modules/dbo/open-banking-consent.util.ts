import { BadRequestException } from "@nestjs/common";

/** CBAR Open Banking Manual — max consent validity (P1-5). */
export const OPEN_BANKING_CONSENT_MAX_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export function validateOpenBankingConsentExpiry(
  issuedAt: Date,
  expiresAt: Date | undefined | null,
): void {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    throw new BadRequestException(
      "expiresAt is required for Open Banking consent",
    );
  }
  if (expiresAt.getTime() <= issuedAt.getTime()) {
    throw new BadRequestException("expiresAt must be after the consent issue time");
  }
  const spanDays = Math.ceil(
    (expiresAt.getTime() - issuedAt.getTime()) / DAY_MS,
  );
  if (spanDays > OPEN_BANKING_CONSENT_MAX_DAYS) {
    throw new BadRequestException(
      `Open Banking consent cannot exceed ${OPEN_BANKING_CONSENT_MAX_DAYS} days (requested ${spanDays})`,
    );
  }
}

/** Lab SCA proof (OTP / ASAN challenge id) before ACTIVE consent — no CBAR gateway. */
export function validateOpenBankingScaChallengeId(
  scaChallengeId: string | undefined | null,
): string {
  const sca = scaChallengeId?.trim();
  if (!sca) {
    throw new BadRequestException(
      "scaChallengeId required (lab SCA / OTP / ASAN) before ACTIVE consent — no CBAR gateway",
    );
  }
  return sca;
}