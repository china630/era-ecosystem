import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { importHotelOrgSlice } from "@/lib/placement-slice.service";
import { ORG_SLICE_FORMAT_VERSION } from "@era/satellite-kit";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  mode: z.enum(["validate", "upsert"]).default("validate"),
  slice: z.object({
    organizationId: z.string().uuid(),
    formatVersion: z.literal(ORG_SLICE_FORMAT_VERSION),
    tables: z.array(
      z.object({
        name: z.string(),
        rowCount: z.number().int().nonnegative(),
      }),
    ),
    rows: z.record(z.array(z.record(z.unknown()))),
    note: z.string(),
  }),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function assertServiceToken(request: Request): boolean {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== "production";
  const auth = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return auth === token;
}

/**
 * Lab import-slice (validate or upsert). Not host restore product.
 */
export async function POST(request: Request) {
  try {
    if (!assertServiceToken(request)) return unauthorized();
    const body = bodySchema.parse(await request.json());
    const result = await importHotelOrgSlice({
      organizationId: body.organizationId,
      slice: body.slice,
      mode: body.mode,
    });
    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 400 });
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
