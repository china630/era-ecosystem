import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, assertFnbEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  seats: z.number().int().positive().optional(),
  zone: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.posTable.findUnique({ where: { id } });
    if (!existing) return jsonError("Table not found", 404);

    if (existing.status === "OCCUPIED" && (body.code || body.name)) {
      // Allow metadata edits while occupied; block delete only.
    }

    const table = await prisma.posTable.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.seats !== undefined ? { seats: body.seats } : {}),
        ...(body.zone !== undefined ? { zone: body.zone } : {}),
      },
    });
    return jsonOk(table);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(_request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const { id } = await params;
    const existing = await prisma.posTable.findUnique({ where: { id } });
    if (!existing) return jsonError("Table not found", 404);
    if (existing.status === "OCCUPIED" || existing.currentTicketId) {
      return jsonError("Cannot delete occupied table", 400);
    }

    await prisma.posTable.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
