import { z } from "zod";
import { assertFnbEntitled, handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const hall = await prisma.posHall.findUnique({ where: { id } });
    if (!hall) return jsonError("Hall not found", 404);
    if (body.direction) {
      const halls = await prisma.posHall.findMany({
        where: { outletId: hall.outletId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      });
      const index = halls.findIndex((row) => row.id === hall.id);
      const swap = body.direction === "up" ? index - 1 : index + 1;
      if (index >= 0 && swap >= 0 && swap < halls.length) {
        const next = [...halls];
        const [moved] = next.splice(index, 1);
        next.splice(swap, 0, moved!);
        await prisma.$transaction(
          next.map((row, order) =>
            prisma.posHall.update({ where: { id: row.id }, data: { sortOrder: order } }),
          ),
        );
      }
    }
    if (body.name) {
      const taken = await prisma.posHall.findMany({
        where: { outletId: hall.outletId, NOT: { id } },
        select: { name: true },
      });
      const key = body.name.toLocaleLowerCase();
      if (taken.some((row) => row.name.trim().toLocaleLowerCase() === key)) {
        return jsonOk({ error: "Hall already exists", code: "HALL_DUPLICATE" }, 409);
      }
      await prisma.posHall.update({ where: { id }, data: { name: body.name } });
    }
    return jsonOk(await prisma.posHall.findUnique({ where: { id } }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.TABLES_MANAGE);
    if (denied) return denied;
    const { id } = await params;
    const hall = await prisma.posHall.findUnique({
      where: { id },
      include: { tables: { select: { status: true, currentTicketId: true } } },
    });
    if (!hall) return jsonError("Hall not found", 404);
    const busy = hall.tables.some((table) => table.status === "OCCUPIED" || table.currentTicketId);
    if (busy) return jsonError("Hall has an open table", 409);
    await prisma.$transaction([
      prisma.posTable.updateMany({ where: { hallId: id }, data: { hallId: null } }),
      prisma.posHall.delete({ where: { id } }),
    ]);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
