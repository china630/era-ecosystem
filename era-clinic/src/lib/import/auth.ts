import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import type { NextResponse } from "next/server";

export async function assertClinicImportAccess(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  const guard = await assertClinicAdminWrite();
  if (guard.error) return { error: guard.error };
  return { userId: guard.session.sub };
}
