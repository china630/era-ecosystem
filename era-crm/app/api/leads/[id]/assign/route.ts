import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ownerId: z.string().nullable(),
});

const ASSIGN_ROLES = new Set(["SALES_LEAD", "BUSINESS_OWNER"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = req.headers.get("x-user-role");
    if (!role || !ASSIGN_ROLES.has(role)) {
      return jsonError("Forbidden — SALES_LEAD or BUSINESS_OWNER required", 403);
    }

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
