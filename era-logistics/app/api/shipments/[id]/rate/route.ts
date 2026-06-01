import { z } from "zod";
import { financeRateQuote } from "@era/satellite-kit";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  weightKg: z.number().min(0),
  zoneFrom: z.string().optional(),
  zoneTo: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);
    const body = bodySchema.parse(await req.json());
    const quote = await financeRateQuote(body, {
      authHeader: req.headers.get("authorization"),
    });
    await prisma.tariffQuoteLog.create({
      data: {
        tripId: id,
        weightKg: body.weightKg,
        amount: quote.amount ?? 0,
        currency: quote.currency ?? "AZN",
      },
    });
    return jsonOk({ tripId: id, ...quote });
  } catch (err) {
    return handleRouteError(err);
  }
}
