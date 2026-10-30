import type { Outlet } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

/** Find outlet by code or create a default row; throws if create fails. */
export async function ensureOutletByCode(code: string): Promise<Outlet> {
  const normalized = code.trim();
  if (normalized.toUpperCase() === "RESTAURANT") {
    throw Object.assign(new Error("Outlet RESTAURANT is retired — use NAFTANI"), {
      code: "OUTLET_RETIRED",
    });
  }
  const organizationId = requestOrganizationId();
  let outlet = await prisma.outlet.findFirst({
    where: { code: normalized, organizationId },
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { organizationId, code: normalized, name: normalized },
    });
  }
  if (!outlet) {
    throw new Error(`Failed to ensure outlet: ${code}`);
  }
  return outlet;
}

/**
 * Till default: explicit code, else KAFE (street edition), else first active.
 * Never invents a phantom RESTAURANT outlet.
 */
export async function resolveOpsOutlet(
  explicitCode?: string | null,
): Promise<Outlet> {
  const code = explicitCode?.trim();
  if (code) {
    if (code.toUpperCase() === "RESTAURANT") {
      throw Object.assign(new Error("Outlet RESTAURANT is retired — use NAFTANI"), {
        code: "OUTLET_RETIRED",
      });
    }
    return ensureOutletByCode(code);
  }
  const organizationId = requestOrganizationId();
  const kafe = await prisma.outlet.findFirst({
    where: { organizationId, code: "KAFE", active: true },
  });
  if (kafe) return kafe;
  const naftani = await prisma.outlet.findFirst({
    where: { organizationId, code: "NAFTANI", active: true },
  });
  if (naftani) return naftani;
  const first = await prisma.outlet.findFirst({
    where: { organizationId, active: true },
    orderBy: { code: "asc" },
  });
  if (first) return first;
  throw Object.assign(new Error("No active F&B outlet — create one in Settings"), {
    code: "OUTLET_REQUIRED",
  });
}

/** GET-only lookup: never creates outlets. */
export async function findOpsOutlet(
  explicitCode?: string | null,
): Promise<Outlet | null> {
  const organizationId = requestOrganizationId();
  const code = explicitCode?.trim();
  if (code) {
    if (code.toUpperCase() === "RESTAURANT") return null;
    return prisma.outlet.findFirst({ where: { organizationId, code, active: true } });
  }
  const kafe = await prisma.outlet.findFirst({
    where: { organizationId, code: "KAFE", active: true },
  });
  if (kafe) return kafe;
  const naftani = await prisma.outlet.findFirst({
    where: { organizationId, code: "NAFTANI", active: true },
  });
  if (naftani) return naftani;
  return prisma.outlet.findFirst({
    where: { organizationId, active: true },
    orderBy: { code: "asc" },
  });
}
