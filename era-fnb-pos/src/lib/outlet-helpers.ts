import type { Outlet } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Find outlet by code or create a default row; throws if create fails. */
export async function ensureOutletByCode(code: string): Promise<Outlet> {
  let outlet = await prisma.outlet.findFirst({ where: { code } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { code, name: code },
    });
  }
  if (!outlet) {
    throw new Error(`Failed to ensure outlet: ${code}`);
  }
  return outlet;
}
