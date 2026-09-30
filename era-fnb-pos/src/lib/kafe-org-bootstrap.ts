import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";
import { enterRequestTenant } from "@/lib/request-organization";

export type KafeOwnerBootstrapInput = {
  organizationId: string;
  email: string;
  password: string;
  fullName: string;
  cafeName: string;
  activeModules: string[];
};

function modulesForKafe(mods: string[]): string[] {
  const set = new Set(mods.filter(Boolean));
  set.add("industry_fnb_pos");
  return [...set];
}

/** Default till: one outlet + one walk-in table so Floor is not empty. */
export async function ensureKafeOpsSkeleton(input: {
  organizationId: string;
  cafeName: string;
  activeModules?: string[];
}): Promise<{ outletId: string }> {
  const organizationId = input.organizationId.trim();
  enterRequestTenant(organizationId);

  const activeModules = modulesForKafe(input.activeModules ?? []);
  await upsertFnbOrgSnapshot(organizationId, {
    edition: "kafe",
    activeModules,
  });
  await ensureSystemFnbRoles(
    prisma,
    organizationId,
    resolveFnbEdition("kafe", false),
  );

  const cafeName = input.cafeName.trim();
  const outlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "KAFE" } },
    update: { active: true },
    create: {
      organizationId,
      code: "KAFE",
      name: cafeName || "Kafe",
      revenueCenterCode: "FOOD",
    },
  });
  if (cafeName) {
    await prisma.outlet.update({
      where: { id: outlet.id },
      data: { name: cafeName },
    });
  }

  await prisma.posTable.upsert({
    where: { outletId_code: { outletId: outlet.id, code: "T-01" } },
    update: {},
    create: {
      outletId: outlet.id,
      organizationId,
      code: "T-01",
      name: "Masa 1",
      seats: 4,
    },
  });

  return { outletId: outlet.id };
}

/** Local owner password (not PIN). Login + email both resolve at F&B /login. */
export async function bootstrapKafeOwner(
  input: KafeOwnerBootstrapInput,
): Promise<{ login: string }> {
  const organizationId = input.organizationId.trim();
  const email = input.email.toLowerCase().trim();
  const password = input.password;
  if (!organizationId || !email || password.length < 8) {
    throw new Error("organizationId, email and password (min 8) are required");
  }

  await ensureKafeOpsSkeleton({
    organizationId,
    cafeName: input.cafeName,
    activeModules: input.activeModules,
  });

  const managerRole = await prisma.role.findFirst({
    where: { organizationId, code: "FB_MANAGER" },
  });
  if (!managerRole) {
    throw new Error("FB_MANAGER role missing after kafe role seed");
  }

  const passwordHash = await hashPassword(password);
  const fullName = input.fullName.trim() || email;
  const login = email;

  const existing = await prisma.user.findFirst({
    where: { organizationId, OR: [{ login }, { email }] },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        login,
        email,
        fullName,
        passwordHash,
        roleId: managerRole.id,
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.user.create({
      data: {
        organizationId,
        login,
        email,
        fullName,
        passwordHash,
        roleId: managerRole.id,
      },
    });
  }

  return { login };
}
