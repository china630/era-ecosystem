import { z } from "zod";
import {
  getRouteSession,
  jsonOk,
  jsonError,
  handleRouteError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { cancelLabOrder } from "@/domain/lab/lab-order-cancel.service";
import { prisma } from "@/lib/prisma";

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Single lab order with items + structural results + patient ref, for the workflow detail page. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;

    const { id } = await params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        patientRef: true,
        visit: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            diagnosticService: { include: { modality: true } },
            results: true,
          },
        },
      },
    });
    if (!order) return jsonError("Lab order not found", 404);
    return jsonOk(order);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Cancel an ORDERED lab order (sets CANCELLED + audit fields). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;

    const { id } = await params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    let reason: string | undefined;
    try {
      const raw = await req.text();
      if (raw.trim()) {
        reason = cancelSchema.parse(JSON.parse(raw)).reason;
      }
    } catch {
      /* optional body */
    }
    const order = await cancelLabOrder(id, {
      userId: session.sub,
      reason,
    });
    return jsonOk(order);
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === "NOT_FOUND") {
      return jsonError("Lab order not found", 404);
    }
    return handleRouteError(err);
  }
}
