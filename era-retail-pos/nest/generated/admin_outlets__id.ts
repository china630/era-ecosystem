import { getOutletById, updateOutletContacts } from "@/lib/outlet.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const optionalContact = z.string().max(200).nullable().optional();

const patchSchema = z.object({
  revenueCode: z.string().max(32).nullable().optional(),
  phone: optionalContact,
  email: optionalContact,
  address: optionalContact,
  website: optionalContact,
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/outlets/:id", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await getOutletById(id);
    if (!existing) return sendJson(httpRes, { error: "Outlet not found" }, 404);
    if (
      body.revenueCode === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.address === undefined &&
      body.website === undefined
    ) {
      return sendJson(httpRes, { error: "No fields to update" }, 400);
    }
    const trimOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null || !String(v).trim() ? null : String(v).trim();
    const row = await updateOutletContacts(id, {
      ...(body.revenueCode !== undefined
        ? { revenueCode: body.revenueCode?.trim() || null }
        : {}),
      ...(body.phone !== undefined ? { phone: trimOrNull(body.phone) } : {}),
      ...(body.email !== undefined ? { email: trimOrNull(body.email) } : {}),
      ...(body.address !== undefined ? { address: trimOrNull(body.address) } : {}),
      ...(body.website !== undefined ? { website: trimOrNull(body.website) } : {}),
    });
    return sendJson(httpRes, {
      id: row.id,
      code: row.code,
      name: row.name,
      revenueCode: row.revenueCode,
      phone: row.phone,
      email: row.email,
      address: row.address,
      website: row.website,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
