import { prisma } from "@/lib/prisma";

export function createCrossDockScan(data: {
  barcode: string;
  hubCode: string;
  tripId?: string;
}) {
  return prisma.crossDockScan.create({ data });
}

export function listRecentCrossDockScans() {
  return prisma.crossDockScan.findMany({
    orderBy: { scannedAt: "desc" },
    take: 50,
  });
}
