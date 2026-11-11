import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import { getPatient, updatePatient, PatientMdmRequiredError, PatientAnamnesisRequiredError, isPatientOnCareTeam } from "@/domain/patient/patient.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patientSex = z.enum(["MALE", "FEMALE", "UNKNOWN"]);
const patientBloodGroup = z.enum([
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
]);

const patientNameAliases = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  lastName: z.string().min(1).optional(),
  givenName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  fatherName: z.string().nullable().optional(),
});

function normalizePatientName(d: z.infer<typeof patientNameAliases>) {
  const firstName = (d.firstName ?? d.givenName ?? "").trim();
  const lastName = (d.lastName ?? d.surname ?? "").trim();
  const middleName =
    d.middleName !== undefined
      ? d.middleName?.trim() || null
      : d.fatherName !== undefined
        ? d.fatherName?.trim() || null
        : undefined;
  return {
    ...(d.firstName !== undefined || d.givenName !== undefined
      ? { firstName: firstName || undefined }
      : {}),
    ...(d.lastName !== undefined || d.surname !== undefined
      ? { lastName: lastName || undefined }
      : {}),
    ...(middleName !== undefined ? { middleName } : {}),
  };
}

const updateSchema = z
  .object({
    ...patientNameAliases.shape,
    fullName: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    sex: patientSex.optional(),
    birthDate: z.string().nullable().optional(),
    bloodGroup: patientBloodGroup.optional(),
    emergencyContactName: z.string().nullable().optional(),
    emergencyContactPhone: z.string().nullable().optional(),
    finCode: z.string().nullable().optional(),
    passportNumber: z.string().nullable().optional(),
    issuingCountry: z.string().nullable().optional(),
    anamnesisText: z.string().nullable().optional(),
  })
  .transform((d) => {
    const { givenName, surname, fatherName, ...rest } = d;
    return { ...rest, ...normalizePatientName(d) };
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/patients/:id", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return denied;
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

        const { id } = httpReq.params;
    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) return sendJson(httpRes, { error: "Not found" }, 404);
      const visible = await isPatientOnCareTeam(id, scope.practitionerId);
      if (!visible) return sendJson(httpRes, { error: "Not found" }, 404);
    }

    const row = await getPatient(id);
    if (!row) return sendJson(httpRes, { error: "Not found" }, 404);
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/patients/:id", async (httpReq, httpRes) => {
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

  try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    return sendJson(httpRes, await updatePatient(id, body));
  } catch (err) {
    if (err instanceof PatientMdmRequiredError || err instanceof PatientAnamnesisRequiredError) {
      return sendJson(httpRes, { error: err.message }, 400);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
