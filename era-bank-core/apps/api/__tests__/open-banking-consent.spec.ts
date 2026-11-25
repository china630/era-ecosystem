import { BadRequestException } from "@nestjs/common";
import {
  validateOpenBankingConsentExpiry,
  validateOpenBankingScaChallengeId,
} from "../src/modules/dbo/open-banking-consent.util";

describe("Open Banking consent expiry (P1-5)", () => {
  const issuedAt = new Date("2026-01-01T12:00:00.000Z");

  it("rejects missing expiresAt", () => {
    expect(() => validateOpenBankingConsentExpiry(issuedAt, null)).toThrow(
      BadRequestException,
    );
  });

  it("accepts 90-day consent", () => {
    const expiresAt = new Date(issuedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(() =>
      validateOpenBankingConsentExpiry(issuedAt, expiresAt),
    ).not.toThrow();
  });

  it("rejects 91-day consent", () => {
    const expiresAt = new Date(issuedAt.getTime() + 91 * 24 * 60 * 60 * 1000);
    expect(() => validateOpenBankingConsentExpiry(issuedAt, expiresAt)).toThrow(
      BadRequestException,
    );
  });

  it("requires scaChallengeId before ACTIVE (lab SCA)", () => {
    expect(() => validateOpenBankingScaChallengeId(undefined)).toThrow(
      BadRequestException,
    );
    expect(() => validateOpenBankingScaChallengeId("  ")).toThrow(
      BadRequestException,
    );
    expect(validateOpenBankingScaChallengeId(" otp-lab-1 ")).toBe("otp-lab-1");
  });
});