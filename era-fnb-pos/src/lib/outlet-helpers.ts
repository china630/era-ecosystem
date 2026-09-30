import type { Outlet } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

/** Find outlet by code or create a default row; throws if create fails. */
export async function ensureOutletByCode(code: string): Promise<Outlet> {
  const organizationId = requestOrganizationId();
  let outlet = await prisma.outlet.findFirst({
    where: { code, organizationId },
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { organizationId, code, name: code },
    });
  }
  if (!outlet) {
    throw new Error(`Failed to ensure outlet: ${code}`);
  }
  return outlet;
}

/**
 * Till default: explicit code, else KAFE (street edition), else first active
 * outlet, else hotel RESTAURANT. Never invent RESTAURANT when KAFE exists.
 */
export async function resolveOpsOutlet(
  explicitCode?: string | null,
): Promise<Outlet> {
  const code = explicitCode?.trim();
  if (code) return ensureOutletByCode(code);
  const organizationId = requestOrganizationId();
  const kafe = await prisma.outlet.findFirst({
    where: { organizationId, code: "KAFE", active: true },
  });
  if (kafe) return kafe;
  const first = await prisma.outlet.findFirst({
    where: { organizationId, active: true },
    orderBy: { code: "asc" },
  });
  if (first) return first;
  return ensureOutletByCode("RESTAURANT");
}

/** GET-only lookup: do not create phantom RESTAURANT for KAFE orgs. */
export async function findOpsOutlet(
  explicitCode?: string | null,
): Promise<Outlet | null> {
  const organizationId = requestOrganizationId();
  const code = explicitCode?.trim();
  if (code) {
    return prisma.outlet.findFirst({ where: { organizationId, code } });
  }
  const kafe = await prisma.outlet.findFirst({
    where: { organizationId, code: "KAFE", active: true },
  });
  if (kafe) return kafe;
  return prisma.outlet.findFirst({
    where: { organizationId, active: true },
    orderBy: { code: "asc" },
  });
}
