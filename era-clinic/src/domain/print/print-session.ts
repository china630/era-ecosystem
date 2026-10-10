import { redirect } from "next/navigation";
import { getSatelliteSession } from "@/lib/api-utils";

/** Bind the staff org before a print page queries Prisma. Middleware auth does not. */
export async function enterPrintSession(): Promise<void> {
  const session = await getSatelliteSession();
  if (!session?.organizationId) redirect("/login");
}
