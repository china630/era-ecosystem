import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureTypes, createProcedureType, purgeNonCabinProcedureTypes, auditMasterChange, findServiceCatalogForProcedureName } from "@/lib/services/clinic-master-data.service";
import { localizedCatalogDescription } from "@era/clinic-domain";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1).optional(),
  durationMin: z.number().int().positive().optional(),
  resourceGapMinutes: z.number().int().min(0).max(240).optional(),
  patientRestMinutes: z.number().int().min(0).max(240).optional(),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  bodyPart: z
    .enum([
      "HEAD",
      "NECK",
      "CHEST",
      "BACK",
      "ABDOMEN",
      "ARM_LEFT",
      "ARM_RIGHT",
      "LEG_LEFT",
      "LEG_RIGHT",
      "FULL_BODY",
    ])
    .nullable()
    .optional(),
  afterLunchAllowed: z.boolean().optional(),
  extendedStartHour: z.number().int().min(0).max(23).nullable().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
  needsSite: z.boolean().optional(),
  openAttendance: z.boolean().optional(),
  blockCategory: z.enum(["PHYSIO", "BATH", "PARAFFIN"]).nullable().optional(),
  usageContour: z.enum(["GUEST", "INTERNAL"]).optional(),
  physioOrderFields: z.array(z.string().min(1)).optional(),
  allowedSiteCodes: z.array(z.string().min(1)).optional(),
  financeSku: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/procedure-types", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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
    const deniedMaster = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_TYPES,
    );
    const deniedTemplates = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    const deniedRules = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
    );
    if (deniedMaster && deniedTemplates && deniedRules) return deniedMaster;
    const locale =
      new URL(req.url).searchParams.get("locale") ??
      req.headers.get("x-era-locale") ??
      "en";
    const blockedNonCabin = await purgeNonCabinProcedureTypes();
    return sendJson(httpRes, {
      items: await listProcedureTypes(locale),
      blockedNonCabin,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/procedure-types", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(httpReq.body);
    let name = body.name?.trim();
    if (!name) {
      const cat = await findServiceCatalogForProcedureName(body.code.trim());
      name = cat ? localizedCatalogDescription(cat, "az") : body.code.trim();
    }
    const row = await createProcedureType({ ...body, name });
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureType",
      row.id,
      "CREATE",
      body,
    );
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
