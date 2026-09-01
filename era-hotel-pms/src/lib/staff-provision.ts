import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  ROLE_CODES,
  permissionsForRole,
  serializePermissions,
} from "@/lib/auth/permissions";

const ROLE_CODES_FROM_CP: Record<string, string> = {
  RECEPTION: ROLE_CODES.RECEPTIONIST,
  HOUSEKEEPING: ROLE_CODES.HOUSEKEEPER,
  MANAGER: ROLE_CODES.MANAGER,
  STAFF: ROLE_CODES.RECEPTIONIST,
};

/** Same pattern as clinic staff-provision + hotel SSO: never fail closed on missing Role row. */
export class SatelliteLoginTakenError extends Error {
  readonly code = "LOGIN_TAKEN" as const;

  constructor(login: string) {
    super(`Login already taken: ${login}`);
    this.name = "SatelliteLoginTakenError";
  }
}

async function resolveUserForLogin(args: {
  cpEmploymentId: string;
  login: string;
  organizationId: string;
}) {
  const byCp = await prisma.user.findFirst({
    where: { cpEmploymentId: args.cpEmploymentId },
  });
  if (byCp) return { existing: byCp, mode: "update" as const };

  const byLogin = await prisma.user.findFirst({
    where: { login: args.login, organizationId: args.organizationId },
  });
  if (
    byLogin?.cpEmploymentId &&
    byLogin.cpEmploymentId !== args.cpEmploymentId
  ) {
    throw new SatelliteLoginTakenError(args.login);
  }
  if (byLogin) return { existing: byLogin, mode: "update" as const };
  return { existing: null, mode: "create" as const };
}

async function ensureRole(code: string) {
  const existing = await prisma.role.findFirst({ where: { code } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      code,
      name: code.replace(/_/g, " "),
      permissionsJson: serializePermissions(permissionsForRole(code)),
    },
  });
}

export async function handleStaffProvisionEvent(event: unknown) {
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const roleCode = ROLE_CODES_FROM_CP[p.satelliteRole] ?? ROLE_CODES.RECEPTIONIST;
    const role = await ensureRole(roleCode);

    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const passwordHash = await hashPassword(p.pin ?? "0000");
    const globalPersonId = parsed.globalPersonId ?? null;
    const cpEmploymentId = p.cpEmploymentId;

    const resolved = await resolveUserForLogin({
      cpEmploymentId,
      login,
      organizationId,
    });

    if (resolved.mode === "update" && resolved.existing) {
      await prisma.user.update({
        where: { id: resolved.existing.id },
        data: {
          login,
          fullName: p.fullName,
          status: "ACTIVE",
          passwordHash,
          globalPersonId,
          cpEmploymentId,
          roleId: role.id,
          ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
        },
      });
      return { satelliteUserId: resolved.existing.id };
    }

    const user = await prisma.user.create({
      data: {
        organizationId,
        login,
        fullName: p.fullName,
        passwordHash,
        roleId: role.id,
        isCrossSystem: true,
        globalPersonId,
        cpEmploymentId,
        ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
      },
    });
    return { satelliteUserId: user.id };
  }

  if (isSatelliteStaffDeactivated(event)) {
    const parsed = satelliteStaffDeactivatedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const target = await resolveUserForDeactivate({
      satelliteUserId: p.satelliteUserId,
      cpEmploymentId: p.cpEmploymentId,
      organizationId,
    });
    if (!target) return { ok: true };
    await prisma.user.updateMany({
      where: { id: target.id },
      data: { status: "DISABLED" },
    });
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}

export class SatelliteTargetAmbiguousError extends Error {
  readonly code = "TARGET_AMBIGUOUS" as const;
  constructor(cpEmploymentId: string) {
    super(`Multiple users for cpEmploymentId=${cpEmploymentId}`);
    this.name = "SatelliteTargetAmbiguousError";
  }
}

async function resolveUserForDeactivate(args: {
  satelliteUserId?: string;
  cpEmploymentId: string;
  organizationId: string;
}): Promise<{ id: string } | null> {
  if (args.satelliteUserId) {
    const byId = await prisma.user.findFirst({
      where: { id: args.satelliteUserId },
      select: { id: true },
    });
    return byId;
  }
  const matches = await prisma.user.findMany({
    where: {
      organizationId: args.organizationId,
      cpEmploymentId: args.cpEmploymentId,
    },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new SatelliteTargetAmbiguousError(args.cpEmploymentId);
  }
  return matches[0]!;
}
