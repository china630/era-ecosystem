import { randomInt } from "node:crypto";
import { InternalServerErrorException } from "@nestjs/common";

/** Inclusive range for human-facing ERA ID (no leading zero). */
export const PUBLIC_ORG_NUMBER_MIN = 100_000;
export const PUBLIC_ORG_NUMBER_MAX = 999_999;

const MAX_ALLOCATE_ATTEMPTS = 32;

export function isValidPublicOrgNumber(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= PUBLIC_ORG_NUMBER_MIN &&
    n <= PUBLIC_ORG_NUMBER_MAX
  );
}

export function parsePublicOrgNumberParam(raw: string): number | null {
  const t = raw.trim();
  if (!/^[1-9][0-9]{5}$/.test(t)) return null;
  const n = Number(t);
  return isValidPublicOrgNumber(n) ? n : null;
}

type OrgNumberClient = {
  organization: {
    findUnique(args: {
      where: { publicOrgNumber: number };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

/**
 * Cryptographically random 6-digit ERA ID. Retries on unique conflict.
 * Never sequential — adjacent typos must not land on a neighbour org.
 */
export async function allocatePublicOrgNumber(
  prisma: OrgNumberClient,
): Promise<number> {
  for (let attempt = 0; attempt < MAX_ALLOCATE_ATTEMPTS; attempt++) {
    const candidate = randomInt(
      PUBLIC_ORG_NUMBER_MIN,
      PUBLIC_ORG_NUMBER_MAX + 1,
    );
    const clash = await prisma.organization.findUnique({
      where: { publicOrgNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new InternalServerErrorException(
    "Could not allocate a unique public organization number",
  );
}
