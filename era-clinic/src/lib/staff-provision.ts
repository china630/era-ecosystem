import { createHash } from "crypto";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { CLINIC_ROLE } from "@/lib/clinic-roles";

function hashPassword(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ROLE_CODES: Record<string, string> = {
  DOCTOR: CLINIC_ROLE.DOCTOR,
  NURSE: CLINIC_ROLE.NURSE,
  CLINIC_ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  RECEPTION: CLINIC_ROLE.RECEPTION,
  ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  STAFF: CLINIC_ROLE.RECEPTION,
};

export async function handleStaffProvisionEvent(event: unknown) {
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const roleCode = ROLE_CODES[p.satelliteRole] ?? CLINIC_ROLE.RECEPTION;
    let role = await prisma.role.findFirst({ where: { code: roleCode } });
    if (!role) {
      role = await prisma.role.create({
        data: { code: roleCode, name: roleCode.replace(/_/g, " ") },
      });
    }

    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const passwordHash = hashPassword(p.pin ?? "0000");

    await prisma.practitioner.upsert({
      where: { code: p.staffCode },
      create: {
        code: p.staffCode,
        fullName: p.fullName,
        globalPersonId: parsed.globalPersonId ?? null,
      },
      update: {
        fullName: p.fullName,
        globalPersonId: parsed.globalPersonId ?? null,
      },
    });

    const existingUser = await prisma.user.findUnique({ where: { login } });
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { fullName: p.fullName, roleId: role.id, status: "ACTIVE" },
      });
      return { satelliteUserId: existingUser.id };
    }

    const user = await prisma.user.create({
      data: {
        login,
        fullName: p.fullName,
        passwordHash,
        roleId: role.id,
        isCrossSystem: true,
      },
    });
    return { satelliteUserId: user.id };
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
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}
