import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { getSatelliteSession } from "@/lib/session";

const bodySchema = z.object({ amount: z.number().positive() });

/** Pay down the holder's debt. The ceiling is usable again only for the settled part. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return denied;
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const organizationId = requestOrganizationId();
    const holder = await prisma.fnbLimitHolder.findFirst({ where: { id, organizationId } });
    if (!holder) return jsonError("Limit holder not found", 404);
    const used = Number(holder.usedAzn);
    if (body.amount > used + 0.001) return jsonError("Settlement is above the open debt", 400);
    const next = Math.max(0, Math.round((used - body.amount) * 100) / 100);
    const updated = await prisma.fnbLimitHolder.update({
      where: { id },
      data: { usedAzn: next },
    });
    await recordFbAudit({ userId: session?.sub, request }, "FnbLimitHolder", id, "SETTLE", {
      amount: body.amount,
      usedAzn: next,
    });
    return jsonOk({
      id: updated.id,
      usedAzn: next,
      availableAzn: Math.round((Number(updated.ceilingAzn) - next) * 100) / 100,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
