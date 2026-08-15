import { z } from "zod";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const schema = z.object({ success: z.boolean().optional() });

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.threeDsComplete(id), body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
