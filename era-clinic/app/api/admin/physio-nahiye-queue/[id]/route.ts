import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import {
  aliasNahiyeQueueItem,
  ignoreNahiyeQueueItem,
} from "@/domain/physio/nahiye-cutover.service";

const patchSchema = z.object({
  action: z.enum(["ignore", "alias"]),
  siteId: z.string().min(1).optional(),
  alias: z.string().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    if (body.action === "ignore") {
      const row = await ignoreNahiyeQueueItem(id);
      await recordClinicAudit(
        { userId: guard.session.sub, request: req },
        "PhysioNahiyeQueue",
        id,
        "UPDATE",
        { action: "ignore" },
      );
      return jsonOk(row);
    }
    if (!body.siteId) {
      return jsonError("siteId required to add an alias", 400);
    }
    const row = await aliasNahiyeQueueItem(id, body.siteId, body.alias);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioNahiyeQueue",
      id,
      "UPDATE",
      { action: "alias", siteId: body.siteId },
    );
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
