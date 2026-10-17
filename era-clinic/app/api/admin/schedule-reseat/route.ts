import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyReseatFuturePlan, previewReseatFuturePlan } from "@/domain/planning/reseat-schedule";

const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().min(1).optional(),
  orderIds: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      return jsonError("Forbidden", 403);
    }
    const body = bodySchema.parse(await req.json());
    if (!body.episodeId && !(body.orderIds ?? []).length) {
      return jsonError("episodeId or orderIds required", 400);
    }
    const result = body.apply ? await applyReseatFuturePlan(body) : await previewReseatFuturePlan(body);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
