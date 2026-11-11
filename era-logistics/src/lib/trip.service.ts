import type { Prisma, TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function listRecentTrips() {
  return prisma.trip.findMany({
    include: { vehicle: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function findVehicleByPlate(plate: string) {
  return prisma.vehicle.findUnique({
    where: { plate } as never,
  });
}

export function createVehicle(data: { plate: string; model?: string }) {
  return prisma.vehicle.create({
    data: { plate: data.plate, model: data.model },
  });
}

export function createTrip(data: {
  vehicleId: string;
  routeCode?: string;
  freightAmount: number;
}) {
  return prisma.trip.create({
    data: {
      vehicleId: data.vehicleId,
      routeCode: data.routeCode,
      freightAmount: data.freightAmount,
      status: "PLANNED",
    },
    include: { vehicle: true },
  });
}

export function findTripById(id: string, include?: Prisma.TripInclude) {
  return prisma.trip.findUnique({
    where: { id },
    ...(include ? { include } : {}),
  });
}

export function findTripWithVehicle(id: string) {
  return prisma.trip.findUnique({
    where: { id },
    include: { vehicle: true },
  });
}

export async function findTripStatusRow(id: string) {
  return prisma.trip.findUnique({ where: { id } }) as Promise<{
    id: string;
    status: TripStatus;
    startedAt: Date | null;
  } | null>;
}

export function updateTripStatus(
  id: string,
  data: { status: TripStatus; startedAt?: Date },
) {
  return prisma.trip.update({
    where: { id },
    data,
    include: { vehicle: true },
  });
}

export function issueWaybill(id: string, waybillNumber: string) {
  return prisma.trip.update({
    where: { id },
    data: {
      waybillNumber,
      waybillIssuedAt: new Date(),
    },
    include: { vehicle: true },
  });
}

export function listTripPoints(tripId: string) {
  return prisma.tripPoint.findMany({
    where: { tripId },
    orderBy: { sequence: "asc" },
  });
}

export type TripPointReplaceInput = {
  addressLabel: string;
  latitude?: number;
  longitude?: number;
};

export async function replaceTripPoints(
  tripId: string,
  points: TripPointReplaceInput[],
  trackingToken: string,
) {
  await prisma.tripPoint.deleteMany({ where: { tripId } });
  const created = await prisma.$transaction(
    points.map((p, i) =>
      prisma.tripPoint.create({
        data: {
          tripId,
          sequence: i + 1,
          addressLabel: p.addressLabel,
          latitude: p.latitude,
          longitude: p.longitude,
        },
      }),
    ),
  );
  await prisma.trip.update({
    where: { id: tripId },
    data: { trackingToken },
  });
  return created;
}

export function findTripPoint(tripId: string, pointId: string) {
  return prisma.tripPoint.findFirst({
    where: { id: pointId, tripId },
  });
}

export function updateTripPoint(
  pointId: string,
  data: {
    status: "PENDING" | "ARRIVED" | "DELIVERED";
    podRecipient?: string;
    podCapturedAt: Date | null;
  },
) {
  return prisma.tripPoint.update({
    where: { id: pointId },
    data: {
      status: data.status,
      podRecipient: data.podRecipient,
      podCapturedAt: data.podCapturedAt,
    },
  });
}

export function captureTripPod(
  id: string,
  data: {
    podRecipient: string;
    podNotes?: string;
    podPhotoUrl: string | null;
    podSignatureUrl: string | null;
  },
) {
  return prisma.trip.update({
    where: { id },
    data: {
      podRecipient: data.podRecipient,
      podNotes: data.podNotes,
      podPhotoUrl: data.podPhotoUrl,
      podSignatureUrl: data.podSignatureUrl,
      podCapturedAt: new Date(),
    },
    include: { vehicle: true },
  });
}

export function completeTrip(id: string) {
  return prisma.trip.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: { vehicle: true },
  });
}

export function updateTripFuelReport(
  id: string,
  data: { fuelLiters: number; fuelCost: number },
) {
  return prisma.trip.update({
    where: { id },
    data: {
      fuelLiters: data.fuelLiters,
      fuelCost: data.fuelCost,
    },
    include: { vehicle: true },
  });
}

export type TripTrackingPayload = Prisma.TripGetPayload<{
  include: {
    vehicle: true;
    points: true;
  };
}>;

export function findTripByTrackingToken(token: string) {
  return prisma.trip.findUnique({
    where: { trackingToken: token } as never,
    include: {
      vehicle: true,
      points: { orderBy: { sequence: "asc" } },
    },
  }) as Promise<TripTrackingPayload | null>;
}

export function createTariffQuoteLog(data: {
  tripId: string;
  weightKg: number;
  amount: number;
  currency: string;
}) {
  return prisma.tariffQuoteLog.create({ data });
}

export function listTripsWithFuelCost(createdAt?: { gte?: Date; lte?: Date }) {
  return prisma.trip.findMany({
    where: {
      fuelCost: { not: null },
      ...(createdAt && Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    },
    include: { vehicle: true },
    orderBy: { createdAt: "desc" },
  });
}

export function listDriverActiveTrips() {
  return prisma.trip.findMany({
    where: { status: { in: ["PLANNED", "IN_TRANSIT"] } },
    include: {
      vehicle: true,
      points: { orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
