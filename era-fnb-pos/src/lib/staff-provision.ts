import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { hashStaffPin } from "@/lib/labor-pin";
import { requestOrganizationId } from "@/lib/request-organization";

const ROLE_CODES: Record<string, string> = {
  WAITER: "FB_WAITER",
  MANAGER: "FB_MANAGER",
  CHEF: "FB_WAITER",
  CASHIER: "FB_WAITER",
  STAFF: "FB_WAITER",
};

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

export async function handleStaffProvisionEvent(event: unknown) {
  /** T3 ops cache: fullName from STAFF_PROVISIONED is display-only; MDM is identity SoR. */
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const organizationId = requestOrganizationId();
    const roleCode = ROLE_CODES[p.satelliteRole] ?? "waiter";
    const role = await prisma.role.findFirst({ where: { code: roleCode } });
    if (!role) throw new Error(`Role not found: ${roleCode}`);

    const pin = p.pin ?? "0000";
    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const cpEmploymentId = p.cpEmploymentId;
    const pinHash = hashStaffPin(pin);
    const passwordHash = await hashPassword(pin);
    const globalPersonId = parsed.globalPersonId ?? null;

    const rosterByCp = await prisma.staffRoster.findFirst({
      where: { cpEmploymentId },
    });
    const rosterByCode =
      rosterByCp ??
      (await prisma.staffRoster.findFirst({
        where: { staffCode: p.staffCode, organizationId },
      }));
    const rosterPatch = {
      fullName: p.fullName,
      pinHash,
      globalPersonId,
      cpEmploymentId,
      active: true,
      ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
    };
    if (rosterByCode) {
      await prisma.staffRoster.update({
        where: { id: rosterByCode.id },
        data: rosterPatch,
      });
    } else {
      await prisma.staffRoster.create({
        data: {
          organizationId,
          staffCode: p.staffCode,
          ...rosterPatch,
        },
      });
    }

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
          globalPersonId,
          cpEmploymentId,
          passwordHash,
          status: "ACTIVE",
          roleId: role.id,
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
        globalPersonId,
        cpEmploymentId,
        isCrossSystem: true,
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
      data: { status: "INACTIVE" },
    });
    // StaffRoster has unique cpEmploymentId (no userId FK) — deactivate that single row.
    await prisma.staffRoster.updateMany({
      where: { cpEmploymentId: p.cpEmploymentId },
      data: { active: false },
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
