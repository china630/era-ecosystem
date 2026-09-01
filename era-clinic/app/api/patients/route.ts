import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  listPatientsPaged,
  createPatient,
  PatientMdmRequiredError,
} from "@/domain/patient/patient.service";
import { patientHasMdmIdentifier } from "@era/clinic-domain";

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
        : null;
  return { firstName, middleName, lastName };
}

const createSchema = z
  .object({
    ...patientNameAliases.shape,
    fullName: z.string().optional(),
    phone: z.string().optional(),
    nationality: z.string().nullable().optional(),
    sex: patientSex.optional(),
    birthDate: z.string().nullable().optional(),
    bloodGroup: patientBloodGroup.optional(),
    emergencyContactName: z.string().nullable().optional(),
    emergencyContactPhone: z.string().nullable().optional(),
    finCode: z.string().optional(),
    passportNumber: z.string().optional(),
    issuingCountry: z.string().optional(),
  })
  .transform((d) => {
    const { givenName, surname, fatherName, ...rest } = d;
    return { ...rest, ...normalizePatientName(d) };
  })
  .refine((d) => Boolean(d.firstName && d.lastName), {
    message: "firstName and lastName are required",
  })
  .refine((d) => patientHasMdmIdentifier(d), {
    message: "Provide FIN or passport with issuing country for MDM resolve",
  });

function parseHasMdm(raw: string | null): 0 | 1 | undefined {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return undefined;
}

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const params = new URL(req.url).searchParams;
    const q = params.get("q") ?? undefined;
    const sexRaw = params.get("sex");
    const bloodRaw = params.get("bloodGroup");
    const pageRaw = params.get("page");
    const pageSizeRaw = params.get("pageSize");
    const ageMinRaw = params.get("ageMin");
    const ageMaxRaw = params.get("ageMax");
    const episodeStatusRaw = params.get("episodeStatus");
    const episodeStatus =
      episodeStatusRaw === "OPEN" ||
      episodeStatusRaw === "CLOSED" ||
      episodeStatusRaw === "ALL"
        ? episodeStatusRaw
        : "ALL";

    const result = await listPatientsPaged({
      q,
      sex: sexRaw && patientSex.safeParse(sexRaw).success ? (sexRaw as z.infer<typeof patientSex>) : undefined,
      bloodGroup:
        bloodRaw && patientBloodGroup.safeParse(bloodRaw).success
          ? (bloodRaw as z.infer<typeof patientBloodGroup>)
          : undefined,
      hasMdm: parseHasMdm(params.get("hasMdm")),
      ageMin: ageMinRaw ? Number(ageMinRaw) : undefined,
      ageMax: ageMaxRaw ? Number(ageMaxRaw) : undefined,
      roomNumber: params.get("roomNumber")?.trim() || undefined,
      includeHotelRooms: params.get("includeHotelRooms") === "1",
      programCode: params.get("programCode")?.trim() || undefined,
      includeProgramCodes: params.get("includeProgramCodes") === "1",
      episodeStatus,
      page: pageRaw ? Number(pageRaw) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const body = createSchema.parse(await req.json());
    return jsonOk(await createPatient(body), 201);
  } catch (err) {
    if (err instanceof PatientMdmRequiredError) {
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
