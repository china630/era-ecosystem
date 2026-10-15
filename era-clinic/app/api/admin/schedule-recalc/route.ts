import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { applyScheduleRecalc, previewScheduleRecalc } from "@/domain/planning/recalculate-schedule";

const bodySchema = z.object({
  apply: z.boolean().default(false),
  episodeId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      return jsonError("Forbidden", 403);
    }
    const body = bodySchema.parse(await req.json());
    const moves = body.apply
      ? await applyScheduleRecalc(body.episodeId)
      : await previewScheduleRecalc(body.episodeId);
    return jsonOk({ moves });
  } catch (err) {
    return handleRouteError(err);
  }
}
