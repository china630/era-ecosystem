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

    const byCp = await prisma.user.findFirst({ where: { cpEmploymentId } });
    const existingUser =
      byCp ??
      (await prisma.user.findFirst({ where: { login, organizationId } }));
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: p.fullName,
          globalPersonId,
          cpEmploymentId,
          passwordHash,
          status: "ACTIVE",
        },
      });
      return { satelliteUserId: existingUser.id };
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
