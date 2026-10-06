import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";

export class SatelliteLoginTakenError extends Error {
  readonly code = "LOGIN_TAKEN" as const;

  constructor(login: string) {
    super(`Login already taken: ${login}`);
    this.name = "SatelliteLoginTakenError";
  }
}

export class UnknownSatelliteRoleError extends Error {
  readonly code = "UNKNOWN_SATELLITE_ROLE" as const;
  constructor(satelliteRole: string) {
    super(
      `Unknown satellite role "${satelliteRole}" — create the role in Hesablar / access`,
    );
    this.name = "UnknownSatelliteRoleError";
  }
}

export class SatelliteTargetAmbiguousError extends Error {
  readonly code = "TARGET_AMBIGUOUS" as const;
  constructor(cpEmploymentId: string) {
    super(`Multiple users for cpEmploymentId=${cpEmploymentId}`);
    this.name = "SatelliteTargetAmbiguousError";
  }
}

function retailRoleCode(satelliteRole: string): string {
  return satelliteRole.trim();
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
  if (byLogin?.cpEmploymentId && byLogin.cpEmploymentId !== args.cpEmploymentId) {
    throw new SatelliteLoginTakenError(args.login);
  }
  if (byLogin) return { existing: byLogin, mode: "update" as const };
  return { existing: null, mode: "create" as const };
}

async function resolveProvisionRole(organizationId: string, satelliteRole: string) {
  await ensureSystemRoles(prisma, organizationId);
  const code = retailRoleCode(satelliteRole);
  if (!code) throw new UnknownSatelliteRoleError(satelliteRole);
  const role = await prisma.role.findFirst({
    where: { organizationId, code },
  });
  if (!role) throw new UnknownSatelliteRoleError(satelliteRole);
  return role;
}

async function resolveUserForDeactivate(args: {
  satelliteUserId?: string;
  cpEmploymentId: string;
  organizationId: string;
}): Promise<{ id: string } | null> {
  if (args.satelliteUserId) {
    const byId = await prisma.user.findFirst({
      where: { id: args.satelliteUserId, organizationId: args.organizationId },
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
  if (matches.length > 1) throw new SatelliteTargetAmbiguousError(args.cpEmploymentId);
  return matches[0]!;
}

export async function handleStaffProvisionEvent(event: unknown) {
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const role = await resolveProvisionRole(organizationId, p.satelliteRole);

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
          isCrossSystem: true,
          ...(p.positionTitle ? { positionTitle: p.positionTitle } : {}),
          ...((p.orgUnitName ?? p.departmentName)
            ? { department: p.orgUnitName ?? p.departmentName }
            : {}),
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
        ...(p.positionTitle ? { positionTitle: p.positionTitle } : {}),
        ...((p.orgUnitName ?? p.departmentName)
          ? { department: p.orgUnitName ?? p.departmentName }
          : {}),
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
