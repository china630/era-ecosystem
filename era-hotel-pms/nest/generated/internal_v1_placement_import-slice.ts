import { z } from "zod";
import { importHotelOrgSlice } from "@/lib/placement-slice.service";
import { ORG_FULL_SLICE_FORMAT_VERSION } from "@era/satellite-kit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  mode: z.enum(["validate", "upsert"]).default("validate"),
  slice: z.object({
    organizationId: z.string().uuid(),
    formatVersion: z.literal(ORG_FULL_SLICE_FORMAT_VERSION),
    modelOrder: z.array(z.string()).min(1),
    tables: z.array(
      z.object({
        name: z.string(),
        rowCount: z.number().int().nonnegative(),
      }),
    ),
    rows: z.record(z.array(z.record(z.unknown()))),
    note: z.string(),
    checksum: z.string().min(8),
    satelliteKey: z.string().optional(),
    objectStorage: z
      .object({
        prefix: z.string(),
        entries: z.array(
          z.object({
            key: z.string(),
            bytes: z.number().optional(),
            contentType: z.string().nullable().optional(),
          }),
        ),
        stub: z.boolean().optional(),
      })
      .optional(),
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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/internal/v1/placement/import-slice", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!assertServiceToken(request)) return unauthorized();
    const body = bodySchema.parse(httpReq.body);
    const result = await importHotelOrgSlice({
      organizationId: body.organizationId,
      slice: {
        ...body.slice,
        objectStorage: body.slice.objectStorage ?? {
          prefix: `org/${body.organizationId}/`,
          entries: [],
          stub: true,
        },
      },
      mode: body.mode,
    });
    if (!result.ok) {
      return sendJson(httpRes, { error: result.reason }, 400);
    }
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
