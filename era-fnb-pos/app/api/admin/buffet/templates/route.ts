import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import {
  createWeekTemplate,
  listWeekTemplates,
} from "@/lib/buffet-week-template.service";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const outletId = url.searchParams.get("outletId") ?? undefined;
    const kindRaw = url.searchParams.get("kind");
    const kind =
      kindRaw === "GUEST" || kindRaw === "STAFF" ? kindRaw : undefined;
    const templates = await listWeekTemplates(outletId || undefined, kind);
    return jsonOk({ templates });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  outletId: z.string().min(1),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
  kind: z.enum(["GUEST", "STAFF"]).optional(),
  active: z.boolean().optional(),
  seedSlots: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = createSchema.parse(await request.json());
    const template = await createWeekTemplate(body);
    return jsonOk(template, 201);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
      return jsonError("Outlet not found", 404);
    }
    return handleRouteError(err);
  }
}
