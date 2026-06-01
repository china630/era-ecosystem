import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  projectId: z.string(),
  equipmentCode: z.string(),
  hours: z.number().min(0),
  logDate: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const row = await prisma.equipmentLog.create({
      data: {
        projectId: body.projectId,
        equipmentCode: body.equipmentCode,
        hours: body.hours,
        logDate: new Date(body.logDate),
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
