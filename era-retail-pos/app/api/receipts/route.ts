import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  description: z.string(),
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

const bodySchema = z.object({
  shiftId: z.string(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
      include: { register: true },
    });
    if (!shift) return jsonError("Shift not found", 404);
    if (shift.status !== "OPEN") return jsonError("Shift is not open", 400);

    const amountNet = body.lines.reduce(
      (sum, line) => sum + line.qty * line.unitPrice,
      0,
    );

    const receipt = await prisma.receipt.create({
      data: {
        outletId: shift.register.outletId,
        registerId: shift.registerId,
        shiftId: shift.id,
        amountNet,
        lines: {
          create: body.lines.map((line) => ({
            description: line.description,
            qty: line.qty,
            unitPrice: line.unitPrice,
            lineTotal: line.qty * line.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });
    return jsonOk(receipt, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
