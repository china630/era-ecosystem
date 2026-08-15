import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { previewAutoBar, applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
  roomTypeId: z.string().optional(),
  baseAmount: z.coerce.number().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const url = new URL(req.url);
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      roomTypeId: url.searchParams.get("roomTypeId") ?? undefined,
      baseAmount: url.searchParams.get("baseAmount") ?? undefined,
    });
    const preview = await previewAutoBar({
      from: new Date(params.from),
      to: new Date(params.to),
      roomTypeId: params.roomTypeId,
      baseAmount: params.baseAmount,
    });
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = querySchema.extend({ dryRun: z.boolean().optional() }).parse(
      await req.json(),
    );
    const result = await applyAutoBar({
      from: new Date(body.from),
      to: new Date(body.to),
      roomTypeId: body.roomTypeId,
      baseAmount: body.baseAmount,
      dryRun: body.dryRun,
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
