import { prisma } from "@/lib/prisma";
import { bridgeRequestOrganizationId } from "@/lib/integration/elektraweb-bridge/config";
import { num, str } from "@/lib/integration/elektraweb-bridge/normalize";

/** QA_HOTEL_RES_GUEST: row.ID = SPA RESNAMEID, row.RESID = hotel reservation id. */
export async function stampStayGuestResNameId(row: Record<string, unknown>): Promise<boolean> {
  const resId = str(row.RESID);
  const resNameId = str(row.ID) ?? (num(row.ID) != null ? String(num(row.ID)) : null);
  if (!resId || !resNameId) return false;
  const orgId = bridgeRequestOrganizationId();
  const updated = await prisma.reservation.updateMany({
    where: { organizationId: orgId, externalRef: resId },
    data: { elektrawebResNameId: resNameId },
  });
  return updated.count > 0;
}
