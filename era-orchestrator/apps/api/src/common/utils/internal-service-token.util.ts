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
  // Named env first. CONTROL_PLANE_SERVICE_TOKEN is the same control-plane
  // identity Finance uses for SSO org provision — accept it when the named
  // key is unset so prod .env that only sets CONTROL_PLANE_SERVICE_TOKEN works.
  let expected = process.env[envKey]?.trim();
  if (!expected) {
    expected = process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim();
  }
  if (!expected && process.env.NODE_ENV !== "production") {
    expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  }
  // SEC-TOK-01: fail closed in production when no service token is configured
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Internal service token not configured");
    }
    return;
  }
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
