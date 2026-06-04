import { UnauthorizedException } from "@nestjs/common";

export function assertInternalServiceToken(
  authorization: string | undefined,
  envKey = "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
): void {
  const expected = process.env[envKey]?.trim();
  if (!expected) return;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : authorization?.trim();
  if (!token || token !== expected) {
    throw new UnauthorizedException("Invalid internal service token");
  }
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-2)}`;
}
