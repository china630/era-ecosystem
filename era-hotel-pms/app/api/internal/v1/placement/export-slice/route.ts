import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import {
  exportHotelOrgSlice,
  hotelSliceMetaSummary,
} from "@/lib/placement-slice.service";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  /** When true, include full `rows` (large). Default: summary + rows for lab. */
  includeRows: z.boolean().optional().default(true),
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
 * PlacementJob export-slice (hotel curated JSON v1).
 * Bearer SATELLITE_EVENT_SERVICE_TOKEN.
 */
export async function POST(request: Request) {
  try {
    if (!assertServiceToken(request)) return unauthorized();
    const body = bodySchema.parse(await request.json());
    const slice = await exportHotelOrgSlice(body.organizationId);
    const summary = hotelSliceMetaSummary(slice);
    if (!body.includeRows) {
      return jsonOk(summary);
    }
    return jsonOk({ ...summary, rows: slice.rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
