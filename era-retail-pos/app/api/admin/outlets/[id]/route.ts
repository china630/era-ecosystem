import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const optionalContact = z.string().max(200).nullable().optional();

const patchSchema = z.object({
  revenueCode: z.string().max(32).nullable().optional(),
  phone: optionalContact,
  email: optionalContact,
  address: optionalContact,
  website: optionalContact,
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const existing = await prisma.outlet.findUnique({ where: { id } });
    if (!existing) return jsonError("Outlet not found", 404);
    if (
      body.revenueCode === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.address === undefined &&
      body.website === undefined
    ) {
      return jsonError("No fields to update", 400);
    }
    const trimOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || !String(v).trim() ? null : String(v).trim();
    const row = await prisma.outlet.update({
      where: { id },
      data: {
        ...(body.revenueCode !== undefined
          ? { revenueCode: body.revenueCode?.trim() || null }
          : {}),
        ...(body.phone !== undefined ? { phone: trimOrNull(body.phone) } : {}),
        ...(body.email !== undefined ? { email: trimOrNull(body.email) } : {}),
        ...(body.address !== undefined ? { address: trimOrNull(body.address) } : {}),
        ...(body.website !== undefined ? { website: trimOrNull(body.website) } : {}),
      },
    });
    return jsonOk({
      id: row.id,
      code: row.code,
      name: row.name,
      revenueCode: row.revenueCode,
      phone: row.phone,
      email: row.email,
      address: row.address,
      website: row.website,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
