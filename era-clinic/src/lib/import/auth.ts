import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";

export type ClinicImportAccess = { userId: string };

export async function assertClinicImportAccess(): Promise<ClinicImportAccess> {
  const guard = await assertClinicAdminWrite();
  if (guard.error) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { userId: guard.session.sub };
}
