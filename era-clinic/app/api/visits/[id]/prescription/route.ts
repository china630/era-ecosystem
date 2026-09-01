import { SATELLITE_CLINIC_PRESCRIPTION_ISSUED } from "@era/contracts";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      qty: z.number().positive(),
      rxRequired: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ).min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json());
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { patientRef: true },
    });
    if (!visit) return jsonError("Visit not found", 404);

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_PRESCRIPTION_ISSUED,
      globalPersonId: visit.patientRef.globalPersonId ?? undefined,
      payload: {
        visitId: visit.id,
        patientRef: visit.patientRef.refCode,
        patientOrigin: visit.patientOrigin,
        lines: body.lines,
        currency: "AZN",
      },
    });

    const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(
      /\/$/,
      "",
    );
    await fetch(`${retailBase}/api/integration/prescription-reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientRef: visit.patientRef.refCode,
        visitId: visit.id,
        lines: body.lines,
      }),
    }).catch(() => null);

    return jsonOk({ visitId: visit.id, reserved: body.lines.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
