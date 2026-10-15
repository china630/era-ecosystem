import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { previewBlankForOrder } from "@/domain/lab/blank-apply";

const bodySchema = z.object({
  profileId: z.string().min(1),
  docxBase64: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const docx = Buffer.from(body.docxBase64, "base64");
    if (docx.length < 4) return jsonError("Empty file", 400);
    const rows = await previewBlankForOrder({ orderId: id, profileId: body.profileId, docx });
    return jsonOk({ rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
