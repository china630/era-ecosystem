import { z } from "zod";
import { handleRouteError, jsonOk } from "@/lib/api-utils";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getSatelliteSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.TICKETS_PAY,
    ]);
    if (denied) return denied;
    const organizationId = requestOrganizationId();
    const rows = await prisma.fnbLimitHolder.findMany({
      where: { organizationId },
      orderBy: { displayName: "asc" },
    });
    return jsonOk(
      rows.map((row) => ({
        ...row,
        ceilingAzn: Number(row.ceilingAzn),
        usedAzn: Number(row.usedAzn),
        availableAzn: Math.round((Number(row.ceilingAzn) - Number(row.usedAzn)) * 100) / 100,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  ceilingAzn: z.number().positive(),
  outletId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return denied;
    const body = createSchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const row = await prisma.fnbLimitHolder.create({
      data: {
        organizationId,
        displayName: body.displayName.trim(),
        ceilingAzn: body.ceilingAzn,
        outletId: body.outletId ?? null,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
