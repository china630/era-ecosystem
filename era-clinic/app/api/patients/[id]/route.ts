import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import {
  getPatient,
  updatePatient,
  PatientMdmRequiredError,
  PatientAnamnesisRequiredError,
} from "@/domain/patient/patient.service";
import { prisma } from "@/lib/prisma";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;
    if (!session) return jsonError("Unauthorized", 401);

        const { id } = await ctx.params;
    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode === "ASSIGNED") {
      if (!scope.practitionerId) return jsonError("Not found", 404);
      const hit = await prisma.patientRef.findFirst({
        where: {
          id,
          episodes: {
            some: {
              careDoctors: { some: { practitionerId: scope.practitionerId } },
            },
          },
        },
        select: { id: true },
      });
      if (!hit) return jsonError("Not found", 404);
    }

    const row = await getPatient(id);
    if (!row) return jsonError("Not found", 404);
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    return jsonOk(await updatePatient(id, body));
  } catch (err) {
    if (err instanceof PatientMdmRequiredError || err instanceof PatientAnamnesisRequiredError) {
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
