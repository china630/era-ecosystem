import { getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

export type RetailImportAccess = {
  userId: string;
};

/**
 * Elektraweb cutover import — `admin:import` (seeded on supervisor and outlet
 * admin; owner and platform super-admin bypass). The single session read for import routes.
 */
export async function assertRetailImportAccess(): Promise<RetailImportAccess> {
  const session = await getSatelliteSession();
  assertPermission(session, PERMISSIONS.ADMIN_IMPORT);
  return { userId: session.sub };
}
