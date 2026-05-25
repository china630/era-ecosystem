import { z } from "zod";
import { TripStatus } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum(["IN_TRANSIT", "DELIVERED"]),
});

const NEXT_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  PLANNED: TripStatus.IN_TRANSIT,
  IN_TRANSIT: TripStatus.DELIVERED,
};

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
    return jsonOk(trip);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);
    if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
      return jsonError("Trip cannot change status", 409);
    }

    const expected = NEXT_STATUS[trip.status];
    if (!expected || expected !== body.status) {
      return jsonError(`Invalid transition from ${trip.status} to ${body.status}`, 400);
    }

    const updated = await prisma.trip.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.status === "IN_TRANSIT" && !trip.startedAt
          ? { startedAt: new Date() }
          : {}),
      },
      include: { vehicle: true },
    });

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
