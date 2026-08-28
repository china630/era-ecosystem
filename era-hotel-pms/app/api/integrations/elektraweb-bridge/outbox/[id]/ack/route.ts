import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { ackElektrawebOutbox } from "@/lib/integration/elektraweb-bridge/outbox.service";

const schema = z.object({
  ok: z.boolean(),
  elektrawebLineId: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateBridgeRequest(request);
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const row = await ackElektrawebOutbox({
      organizationId: auth.organizationId,
      id,
      ok: body.ok,
      elektrawebLineId: body.elektrawebLineId,
      error: body.error,
    });
    return jsonOk({ id: row.id, status: row.status, organizationId: auth.organizationId });
  } catch (err) {
    return handleRouteError(err);
  }
}
