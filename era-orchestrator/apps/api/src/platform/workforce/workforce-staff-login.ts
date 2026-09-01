import { BadRequestException, ConflictException } from "@nestjs/common";
import { WorkforceEmploymentStatus } from "@era365/database";

const LOGIN_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;

type LoginLookupClient = {
  workforceEmployment: {
    findFirst: (args: {
      where: {
        organizationId: string;
        status: typeof WorkforceEmploymentStatus.ACTIVE;
        satelliteStaffLogin: {
          equals: string;
          mode: "insensitive";
        };
        id?: { not: string };
      };
    }) => Promise<{ id: string } | null>;
  };
};

export async function assertSatelliteLoginAvailable(
  prisma: LoginLookupClient,
  organizationId: string,
  login: string,
  excludeEmploymentId?: string,
): Promise<void> {
  const normalized = login.trim().toLowerCase();
  if (!normalized) return;
  const taken = await prisma.workforceEmployment.findFirst({
    where: {
      organizationId,
      status: WorkforceEmploymentStatus.ACTIVE,
      satelliteStaffLogin: { equals: normalized, mode: "insensitive" },
      ...(excludeEmploymentId ? { id: { not: excludeEmploymentId } } : {}),
    },
  });
  if (taken) {
    throw new ConflictException({
      code: "LOGIN_TAKEN",
      message: "Satellite login is already assigned to another active employment",
    });
  }
}

export function staffCodeFromEmployment(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function defaultSatelliteStaffLogin(employmentId: string): string {
  return `emp-${staffCodeFromEmployment(employmentId).toLowerCase()}`;
}

/** Normalize optional CP override; throws on invalid shape. */
export function normalizeSatelliteStaffLogin(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const login = trimmed.toLowerCase();
  if (!LOGIN_RE.test(login)) {
    throw new BadRequestException(
      "login must be 1–64 chars: lowercase letters, digits, dot, hyphen",
    );
  }
  return login;
}

export function normalizeSatelliteStaffPin(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 32) {
    throw new BadRequestException("pin must be at most 32 characters");
  }
  return trimmed;
}

export function resolveSatelliteStaffLogin(
  employmentId: string,
  stored: string | null | undefined,
  override?: string | null,
): string {
  const fromOverride = normalizeSatelliteStaffLogin(override ?? undefined);
  if (fromOverride) return fromOverride;
  const fromStored = normalizeSatelliteStaffLogin(stored ?? undefined);
  if (fromStored) return fromStored;
  return defaultSatelliteStaffLogin(employmentId);
}

export function resolveSatelliteStaffPin(
  stored: string | null | undefined,
  override?: string | null,
): string {
  return normalizeSatelliteStaffPin(override ?? undefined) ??
    normalizeSatelliteStaffPin(stored ?? undefined) ??
    "0000";
}
