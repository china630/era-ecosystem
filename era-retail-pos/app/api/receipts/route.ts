import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import {
  computeLineTotal,
  validateReceiptLines,
} from "@/lib/receipt-line-validation";
import { resolveOutletPreset } from "@/lib/retail-preset";
import { prisma } from "@/lib/prisma";

const lineSchema = z.object({
  description: z.string(),
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  plu: z.string().optional(),
  barcode: z.string().optional(),
  isWeighted: z.boolean().optional(),
  weightKg: z.number().positive().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  serial: z.string().optional(),
  batch: z.string().optional(),
  rxRequired: z.boolean().optional(),
  rxApprovedBy: z.string().optional(),
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
      include: { register: { include: { outlet: true } } },
    });
    if (!shift) return jsonError("Shift not found", 404);
    if (shift.status !== "OPEN") return jsonError("Shift is not open", 400);

    const preset = resolveOutletPreset(shift.register.outlet.preset);
    const validationError = validateReceiptLines(preset, body.lines);
    if (validationError) return jsonError(validationError, 400);

    const amountNet = body.lines.reduce(
      (sum, line) => sum + computeLineTotal(line),
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
            lineTotal: computeLineTotal(line),
            plu: line.plu ?? null,
            barcode: line.barcode ?? null,
            isWeighted: line.isWeighted ?? false,
            weightKg: line.weightKg ?? null,
            size: line.size ?? null,
            color: line.color ?? null,
            serial: line.serial ?? null,
            batch: line.batch ?? null,
            rxRequired: line.rxRequired ?? false,
            rxApprovedBy: line.rxApprovedBy ?? null,
            lineStatus: "ACTIVE",
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
