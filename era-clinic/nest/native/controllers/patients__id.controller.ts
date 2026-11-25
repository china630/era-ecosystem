import { Controller, Get, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import { getPatient, updatePatient, PatientMdmRequiredError, PatientAnamnesisRequiredError, isPatientOnCareTeam } from "@/domain/patient/patient.service";


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

@Controller()
export class PatientsIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/patients/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS_READ);
    if (denied) return clinicBody(denied);
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);

        const { id } = httpReq.params;
    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) throw new HttpException({ error: "Not found" }, 404);
      const visible = await isPatientOnCareTeam(id, scope.practitionerId);
      if (!visible) throw new HttpException({ error: "Not found" }, 404);
    }

    const row = await getPatient(id);
    if (!row) throw new HttpException({ error: "Not found" }, 404);
    return row;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/patients/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return clinicBody(denied);

        const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    return await updatePatient(id, body);
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof PatientMdmRequiredError || err instanceof PatientAnamnesisRequiredError) {
      throw new HttpException({ error: err.message }, 400);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
