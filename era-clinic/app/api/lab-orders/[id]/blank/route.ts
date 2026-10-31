import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { previewWordForOrder } from "@/domain/lab/blank-apply";

const bodySchema = z.object({
  profileId: z.string().min(1).optional(),
  docxBase64: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;
    const { id } = await ctx.params;
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.labOrder.findUnique({
      where: { id },
      select: { amountNet: true, settledAt: true },
    });
    if (!order) return jsonError("Order not found", 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) return jsonError(unpaid.message, unpaid.status, { code: unpaid.code });
    const body = bodySchema.parse(await req.json());
    const docx = Buffer.from(body.docxBase64, "base64");
    if (docx.length < 4) return jsonError("Empty file", 400);
    const preview = await previewWordForOrder({
      orderId: id,
      docx,
      profileId: body.profileId,
    });
    if (!preview) return jsonError("Order not found", 404);
    if (preview.mode === "missing") return jsonError("No Word blank for this panel", 404, { code: "NO_BLANK" });
    if (preview.mode === "fields" && Object.keys(preview.fields).length === 0) {
      return jsonError("No panel fields in this file", 422, { code: "NO_USM_FIELDS" });
    }
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
