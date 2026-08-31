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

    const byCp = await prisma.user.findFirst({ where: { cpEmploymentId } });
    const existingUser =
      byCp ??
      (await prisma.user.findFirst({ where: { login, organizationId } }));

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: p.fullName,
          status: "ACTIVE",
          passwordHash,
          globalPersonId,
          cpEmploymentId,
          roleId: role.id,
          ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
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
    if (p.satelliteUserId) {
      await prisma.user.updateMany({
        where: { id: p.satelliteUserId },
        data: { status: "DISABLED" },
      });
    }
    await prisma.user.updateMany({
      where: { cpEmploymentId: p.cpEmploymentId },
      data: { status: "DISABLED" },
    });
    return { ok: true };
  }

  throw new Error("Unsupported staff provision event");
}
