import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import type { ClinicJson } from "@/lib/clinic-json";

export async function assertClinicImportAccess(
  req: { url: string },
): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: ClinicJson }
> {
  const guard = await assertClinicAdminRoute(req);
  if (guard.error) return { error: guard.error };
  return { userId: guard.session.sub };
}
