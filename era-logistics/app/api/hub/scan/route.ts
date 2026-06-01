import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  barcode: z.string().min(1),
  hubCode: z.string().default("HUB1"),
  tripId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const scan = await prisma.crossDockScan.create({
      data: {
        barcode: body.barcode,
        hubCode: body.hubCode,
        tripId: body.tripId,
      },
    });
    return jsonOk(scan, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET() {
  try {
    const scans = await prisma.crossDockScan.findMany({
      orderBy: { scannedAt: "desc" },
      take: 50,
    });
    return jsonOk({ scans });
  } catch (err) {
    return handleRouteError(err);
  }
}
