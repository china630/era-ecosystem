import { createHash } from "crypto";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

const ROLE_CODES: Record<string, string> = {
  WAITER: "waiter",
  MANAGER: "manager",
  CHEF: "chef",
  CASHIER: "cashier",
  STAFF: "waiter",
};

export async function handleStaffProvisionEvent(event: unknown) {
  /** T3 ops cache: fullName from STAFF_PROVISIONED is display-only; MDM is identity SoR. */
  if (isSatelliteStaffProvisioned(event)) {
    const parsed = satelliteStaffProvisionedSchema.parse(event);
    const p = parsed.payload;
    const roleCode = ROLE_CODES[p.satelliteRole] ?? "waiter";
    const role = await prisma.role.findFirst({ where: { code: roleCode } });
    if (!role) throw new Error(`Role not found: ${roleCode}`);

    const pin = p.pin ?? "0000";
    const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
    const cpEmploymentId = p.cpEmploymentId;

    await prisma.staffRoster.upsert({
      where: { staffCode: p.staffCode } as never,
      create: {
        staffCode: p.staffCode,
        fullName: p.fullName,
        pinHash: hashPin(pin),
        globalPersonId: parsed.globalPersonId ?? null,
        cpEmploymentId,
        ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
        active: true,
      },
      update: {
        fullName: p.fullName,
        pinHash: hashPin(pin),
        globalPersonId: parsed.globalPersonId ?? null,
        cpEmploymentId,
        active: true,
      },
    });

    const byCp = await prisma.user.findFirst({ where: { cpEmploymentId } });
    const existingUser = byCp ?? (await prisma.user.findFirst({ where: { login } }));
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: p.fullName,
          globalPersonId: parsed.globalPersonId ?? null,
          cpEmploymentId,
          status: "ACTIVE",
        },
      });
      return { satelliteUserId: existingUser.id };
    }

    const user = await prisma.user.create({
      data: {
        login,
        fullName: p.fullName,
        passwordHash: hashPin(pin),
        roleId: role.id,
        globalPersonId: parsed.globalPersonId ?? null,
        cpEmploymentId,
        isCrossSystem: true,
      },
    });
    return { satelliteUserId: user.id };
  }

  if (isSatelliteStaffDeactivated(event)) {
    const parsed = satelliteStaffDeactivatedSchema.parse(event);
    const p = parsed.payload;
    await prisma.staffRoster.updateMany({
      where: { cpEmploymentId: p.cpEmploymentId },
      data: { active: false },
    });
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
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}
