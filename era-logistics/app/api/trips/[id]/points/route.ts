import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const pointSchema = z.object({
  addressLabel: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const createSchema = z.object({
  points: z.array(pointSchema).min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const points = await prisma.tripPoint.findMany({
      where: { tripId: id },
      orderBy: { sequence: "asc" },
    });
    return jsonOk(points);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return jsonError("Trip not found", 404);
    const body = createSchema.parse(await req.json());

    await prisma.tripPoint.deleteMany({ where: { tripId: id } });
    const created = await prisma.$transaction(
      body.points.map((p, i) =>
        prisma.tripPoint.create({
          data: {
            tripId: id,
            sequence: i + 1,
            addressLabel: p.addressLabel,
            latitude: p.latitude,
            longitude: p.longitude,
          },
        }),
      ),
    );

    const token =
      trip.trackingToken ?? `trk_${randomBytes(8).toString("hex")}`;
    await prisma.trip.update({
      where: { id },
      data: { trackingToken: token },
    });

    return jsonOk({ points: created, trackingToken: token }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
