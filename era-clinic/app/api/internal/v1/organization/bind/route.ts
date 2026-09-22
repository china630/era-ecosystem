import { createOrganizationBindHandlers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureClinicCatalogFromTemplates } from "@/domain/catalog/ensure-clinic-catalog-from-templates";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";

const handlers = createOrganizationBindHandlers({
  getPrisma: () => prisma,
});

export const GET = handlers.GET;

export async function POST(request: Request) {
  const res = await handlers.POST(request);
  if (!res.ok) return res;
  try {
    const body = (await res.clone().json()) as { organizationId?: string };
    const orgId = body.organizationId?.trim();
    if (orgId && orgId !== "demo-org") {
      await ensureSystemClinicRoles(prisma, orgId);
      await ensureClinicCatalogFromTemplates(prisma, orgId);
    }
  } catch (err) {
    console.error("[clinic] post-bind catalog ensure failed", err);
  }
  return res;
}
