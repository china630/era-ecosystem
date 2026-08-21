import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assignLeadDenied } from "@/lib/lead-assign-gates";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ownerId: z.string().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = req.headers.get("x-user-role");
    const assignDenied = assignLeadDenied(role);
    if (assignDenied) return jsonError(assignDenied, 403);

    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    if (body.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
      if (!owner) return jsonError("Owner user not found", 404);
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: { ownerId: body.ownerId },
      include: {
        owner: { select: { id: true, fullName: true, login: true } },
      },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
