import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  recipient: z.string().min(1),
  notes: z.string().optional(),
  podPhotoUrl: z.string().max(2048).optional(),
  podSignatureUrl: z.string().max(2048).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);

    const updated = await prisma.trip.update({
      where: { id },
      data: {
        podRecipient: body.recipient,
        podNotes: body.notes,
        podPhotoUrl: body.podPhotoUrl?.trim() || null,
        podSignatureUrl: body.podSignatureUrl?.trim() || null,
        podCapturedAt: new Date(),
      },
      include: { vehicle: true },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!trip) return jsonError("Trip not found", 404);

    return jsonOk({
      tripId: trip.id,
      captured: Boolean(trip.podCapturedAt),
      recipient: trip.podRecipient,
      notes: trip.podNotes,
      capturedAt: trip.podCapturedAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
