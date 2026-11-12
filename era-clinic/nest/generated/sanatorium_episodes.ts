import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import { listOpenEpisodes, registerWalkInEpisode } from "@/lib/services/sanatorium.service";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const listQuerySchema = z.object({
  organizationId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  origin: z.string().optional(),
  roomNumber: z.string().optional(),
  programCode: z.string().optional(),
  course: z.enum(["ready", "attention", "blocked"]).optional(),
  arrivalFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeHotelRooms: z.boolean().optional(),
  includeProgramCodes: z.boolean().optional(),
  sort: z.enum(["patient", "room", "origin", "program", "status", "arrival"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const patientNameAliases = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1).optional(),
  givenName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  fatherName: z.string().optional().nullable(),
});

function normalizeWalkInName(d: z.infer<typeof patientNameAliases>) {
  const firstName = (d.firstName ?? d.givenName ?? "").trim();
  const lastName = (d.lastName ?? d.surname ?? "").trim();
  const middleName =
    d.middleName !== undefined
      ? d.middleName?.trim() || null
      : d.fatherName !== undefined
        ? d.fatherName?.trim() || null
        : null;
  return { firstName, middleName, lastName };
}

const walkInSchema = z
  .object({
    ...patientNameAliases.shape,
    fullName: z.string().optional(),
    fin: z.string().optional(),
    passport: z.string().optional(),
    phone: z.string().optional(),
    sex: z.enum(["MALE", "FEMALE"]),
    birthDate: z.string().optional(),
    nationality: z.string().optional(),
    issuingCountry: z.string().optional(),
    globalPersonId: z.string().optional(),
    programCode: z.string().optional(),
  })
  .transform((d) => {
    const { givenName, surname, fatherName, ...rest } = d;
    return { ...rest, ...normalizeWalkInName(d) };
  })
  .refine(
    (b) =>
      Boolean(b.fullName?.trim()) ||
      (Boolean(b.firstName?.trim()) && Boolean(b.lastName?.trim())),
    { message: "firstName+lastName or fullName required" },
  );

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes", async (httpReq, httpRes) => {
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
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const url = new URL(req.url);
    const query = listQuerySchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
      roomNumber: url.searchParams.get("roomNumber") ?? undefined,
      programCode: url.searchParams.get("programCode") ?? undefined,
      course: url.searchParams.get("course") ?? undefined,
      arrivalFrom: url.searchParams.get("arrivalFrom") ?? undefined,
      includeHotelRooms: url.searchParams.get("includeHotelRooms") === "1",
      includeProgramCodes: url.searchParams.get("includeProgramCodes") === "1",
      sort: url.searchParams.get("sort") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    });
    const dataScope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    const result = await listOpenEpisodes({ ...query, dataScope });
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/episodes", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return denied;
    const body = walkInSchema.parse(httpReq.body);
    let boundOrg: string | undefined;
    try {
      const id = requestOrganizationId();
      boundOrg = id === "demo-org" ? undefined : id;
    } catch {
      boundOrg = undefined;
    }
    const organizationId =
      boundOrg ??
      new URL(req.url).searchParams.get("organizationId") ??
      "local-clinic";
    const firstName = body.firstName ?? "";
    const lastName = body.lastName ?? "";
    const middleName = body.middleName ?? null;
    const episode = await registerWalkInEpisode({
      organizationId,
      firstName,
      lastName,
      middleName,
      fullName:
        body.fullName?.trim() ||
        composeFullName({ firstName, lastName, middleName }),
      fin: body.fin,
      passport: body.passport,
      phone: body.phone,
      sex: body.sex,
      birthDate: body.birthDate,
      nationality: body.nationality,
      issuingCountry: body.issuingCountry,
      globalPersonId: body.globalPersonId,
      programCode: body.programCode,
    });
    return sendJson(httpRes, episode, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
