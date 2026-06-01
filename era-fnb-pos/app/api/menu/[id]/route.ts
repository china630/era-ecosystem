import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  priceAzn: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
    if (denied) return denied;

    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) return jsonError("Menu item not found", 404);

    const item = await prisma.menuItem.update({
      where: { id },
      data: body,
    });
    return jsonOk(item);
  } catch (err) {
    return handleRouteError(err);
  }
}
