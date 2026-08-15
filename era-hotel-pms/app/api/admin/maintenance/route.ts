import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const createSchema = z.object({
  roomId: z.string().nullable().optional(),
  title: z.string().min(1).max(200).default("Maintenance"),
  reportedBy: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const orders = await prisma.maintenanceWorkOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = createSchema.parse(await request.json());
    const wo = await prisma.maintenanceWorkOrder.create({
      data: {
        roomId: body.roomId ?? null,
        title: body.title,
        reportedBy: body.reportedBy ?? null,
        status: "OPEN",
      },
    });
    return NextResponse.json(wo, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
