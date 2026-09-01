import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  format: z.enum(["CSV", "HL7_FRAGMENT"]).optional(),
  delimiter: z.string().optional(),
  columnMapping: z.record(z.string()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(_req);
    if (guard.error) return guard.error;
    const { id } = await params;
    const profile = await prisma.lisFileProfile.findUnique({ where: { id } });
    if (!profile) return jsonError("Profile not found", 404);
    return jsonOk(profile);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const profile = await prisma.lisFileProfile.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.format !== undefined ? { format: body.format } : {}),
        ...(body.delimiter !== undefined ? { delimiter: body.delimiter } : {}),
        ...(body.columnMapping !== undefined
          ? { columnMapping: JSON.stringify(body.columnMapping) }
          : {}),
      },
    });
    return jsonOk(profile);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(_req);
    if (guard.error) return guard.error;
    const { id } = await params;
    await prisma.lisFileProfile.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
