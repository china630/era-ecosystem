import { UnauthorizedException } from "@nestjs/common";

export function extractServiceToken(
  authorization?: string,
  xServiceToken?: string,
): string | undefined {
  if (xServiceToken?.trim()) return xServiceToken.trim();
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return authorization?.trim();
}

export function assertInternalServiceToken(
  authorization: string | undefined,
  envKey = "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
  xServiceToken?: string,
): void {
  const expected =
    process.env[envKey]?.trim() ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return;
  const token = extractServiceToken(authorization, xServiceToken);
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
