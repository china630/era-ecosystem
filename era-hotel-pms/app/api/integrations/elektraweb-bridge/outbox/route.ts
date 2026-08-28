import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import {
  getElektrawebBridgePolicy,
  isPolicyWriteEnabled,
} from "@/lib/integration/elektraweb-bridge/config";
import {
  claimPendingOutbox,
  enqueueElektrawebOutbox,
  ElektrawebOutboxError,
} from "@/lib/integration/elektraweb-bridge/outbox.service";
import { verifyPosBridge } from "@/lib/pos-bridge-auth";

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  source: z.enum(["CLINIC", "FNB"]).default("CLINIC"),
  idempotencyKey: z.string().min(4).max(120),
  patientOrigin: z.enum(["IN_HOUSE", "WALK_IN"]),
  reservationId: z.string().uuid().optional(),
  procedureCode: z.string().min(1),
  procedureName: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateBridgeRequest(request);
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const writeEnabled = isPolicyWriteEnabled(policy);
    if (!writeEnabled) {
      return jsonOk({ writeEnabled: false, organizationId: auth.organizationId, items: [] });
    }
    const claimed = await claimPendingOutbox(auth.organizationId, 5);
    return jsonOk({
      writeEnabled: true,
      organizationId: auth.organizationId,
      items: claimed.map((row) => ({
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        insert: {
          urlPath: "/Execute/SP_SPA_SAVE",
          body: row.insertPayload,
        },
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = enqueueSchema.parse(await request.json());
    if (!verifyPosBridge(request)) {
      const auth = await authenticateBridgeRequest(request);
      if (auth.organizationId !== body.organizationId) {
        return Response.json(
          { error: "organizationId does not match bridge token org" },
          { status: 403 },
        );
      }
    }
    enterSatelliteTenant({ organizationId: body.organizationId });
    const row = await enqueueElektrawebOutbox({
      organizationId: body.organizationId,
      source: body.source,
      idempotencyKey: body.idempotencyKey,
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId,
      procedureCode: body.procedureCode,
      procedureName: body.procedureName,
      amount: body.amount,
      description: body.description,
    });
    return jsonOk(
      {
        id: row.id,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        elektrawebResNameId: row.elektrawebResNameId,
        organizationId: row.organizationId,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ElektrawebOutboxError) {
      return handleRouteError(err);
    }
    return handleRouteError(err);
  }
}
