import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  vin: z.string().max(32).optional(),
  intakeNotes: z.string().optional(),
  intakePhotoUrls: z.array(z.string().max(2048)).optional(),
  checklist: z.record(z.boolean()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return jsonError("Work order not found", 404);
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        vin: body.vin?.trim() || wo.vin,
        intakeNotes: body.intakeNotes,
        intakePhotoUrls: body.checklist
          ? JSON.stringify({ photos: body.intakePhotoUrls ?? [], checklist: body.checklist })
          : body.intakePhotoUrls
            ? JSON.stringify({ photos: body.intakePhotoUrls })
            : wo.intakePhotoUrls,
        intakeCompletedAt: new Date(),
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
