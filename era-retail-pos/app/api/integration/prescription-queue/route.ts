import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant, requestOrganizationId } from "@/lib/request-organization";

const lineSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().positive(),
  description: z.string().optional(),
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  visitId: z.string().min(1),
  patientRef: z.string().min(1),
  patientOrigin: z.string().min(1),
  reservationId: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

function serviceToken(request: Request): boolean {
  const expected =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.POS_BRIDGE_SECRET?.trim() ||
    "";
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!serviceToken(request)) return jsonError("Unauthorized", 401);
    const body = createSchema.parse(await request.json());
    enterRequestTenant(body.organizationId);
    const row = await prisma.prescriptionQueue.create({
      data: {
        organizationId: requestOrganizationId() || body.organizationId,
        visitId: body.visitId,
        patientRef: body.patientRef,
        patientOrigin: body.patientOrigin,
        reservationId: body.reservationId ?? null,
        linesJson: JSON.stringify(body.lines),
      },
    });
    return jsonOk({ id: row.id, status: row.status }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
