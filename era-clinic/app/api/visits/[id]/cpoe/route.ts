import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  templateId: z.string().optional(),
  payloadJson: z.string().default("{}"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) return jsonError("Visit not found", 404);
    const body = bodySchema.parse(await req.json());
    const entry = await prisma.cpoeEntry.create({
      data: { visitId: id, templateId: body.templateId, payloadJson: body.payloadJson },
    });
    return jsonOk(entry, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
