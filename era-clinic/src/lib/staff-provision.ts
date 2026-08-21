import { createHash } from "crypto";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { staffKindFromSatelliteRole } from "@/domain/staff/staff-kind";

function hashPassword(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ROLE_CODES: Record<string, string> = {
  DOCTOR: CLINIC_ROLE.DOCTOR,
  NURSE: CLINIC_ROLE.NURSE,
  FLOOR: CLINIC_ROLE.FLOOR,
  LAB_TECH: CLINIC_ROLE.LAB_TECH,
  LAB: CLINIC_ROLE.LAB_TECH,
  CLINIC_ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  RECEPTION: CLINIC_ROLE.RECEPTION,
  ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  STAFF: CLINIC_ROLE.RECEPTION,
};

async function ensureRole(roleCode: string) {
  let role = await prisma.role.findFirst({ where: { code: roleCode } });
  if (!role) {
    role = await prisma.role.create({
      data: { code: roleCode, name: roleCode.replace(/_/g, " ") },
    });
  }
  if (!role) throw new Error(`Failed to ensure role: ${roleCode}`);
  return role;
}

export async function handleStaffProvisionEvent(event: unknown) {
  /** T3 ops cache: fullName from STAFF_PROVISIONED is display-only; MDM is identity SoR. */
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const roleCode = ROLE_CODES[p.satelliteRole] ?? CLINIC_ROLE.RECEPTION;
    const role = await ensureRole(roleCode);

    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const passwordHash = hashPassword(p.pin ?? "0000");
    const globalPersonId = parsed.globalPersonId ?? null;
    const cpEmploymentId = p.cpEmploymentId;

    const byCp = await prisma.user.findFirst({ where: { cpEmploymentId } });
    const existingUser = byCp ?? (await prisma.user.findFirst({ where: { login } }));
    let userId: string;
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: p.fullName,
          roleId: role.id,
          status: "ACTIVE",
          globalPersonId,
          cpEmploymentId,
          ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
        },
      });
      userId = existingUser.id;
    } else {
      const user = await prisma.user.create({
        data: {
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
      userId = user.id;
    }

    const staffKind = staffKindFromSatelliteRole(p.satelliteRole);
    const practitionerBase = {
      code: p.staffCode,
      fullName: p.fullName,
      staffKind,
      globalPersonId,
      cpEmploymentId,
      userId,
      active: true,
      ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
    };

    await prisma.practitioner.upsert({
      where: { cpEmploymentId },
      create: practitionerBase,
      update: {
        fullName: p.fullName,
        staffKind,
        globalPersonId,
        userId,
        active: true,
        ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
      },
    });

    return { satelliteUserId: userId };
  }

  if (isSatelliteStaffDeactivated(event)) {
    const parsed = satelliteStaffDeactivatedSchema.parse(event);
    const p = parsed.payload;
    if (p.satelliteUserId) {
      await prisma.user.updateMany({
        where: { id: p.satelliteUserId },
        data: { status: "INACTIVE" },
      });
    }
    await prisma.user.updateMany({
      where: { cpEmploymentId: p.cpEmploymentId },
      data: { status: "INACTIVE" },
    });
    await prisma.practitioner.updateMany({
      where: { cpEmploymentId: p.cpEmploymentId },
      data: { active: false },
    });
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}
