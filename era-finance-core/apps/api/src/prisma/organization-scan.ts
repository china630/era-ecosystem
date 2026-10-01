import type { PrismaService } from "./prisma.service";
import { runWithTenantContextAsync } from "./tenant-context";

/**
 * Lookup by a key unique across organizations (public invoice token, signature id)
 * on routes without a signed org: organizations come from the `Organization`
 * directory and each one is read with the tenant filter on.
 */
export async function findInOrganizations<T>(
  prisma: PrismaService,
  find: (organizationId: string) => Promise<T | null>,
): Promise<{ organizationId: string; row: T } | null> {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const { id } of orgs) {
    const row = await runWithTenantContextAsync(
      { organizationId: id, skipTenantFilter: false },
      () => find(id),
    );
    if (row != null) return { organizationId: id, row };
  }
  return null;
}
