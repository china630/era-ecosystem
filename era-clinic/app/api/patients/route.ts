import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import {
  listPatients,
  createPatient,
  PatientMdmRequiredError,
} from "@/domain/patient/patient.service";
import { patientHasMdmIdentifier } from "@era/clinic-domain";

const patientSex = z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]);
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

const createSchema = z
  .object({
    refCode: z.string().min(1),
    fullName: z.string().min(1),
    phone: z.string().optional(),
    nationality: z.string().optional(),
    sex: patientSex.optional(),
    birthDate: z.string().nullable().optional(),
    bloodGroup: patientBloodGroup.optional(),
    emergencyContactName: z.string().nullable().optional(),
    emergencyContactPhone: z.string().nullable().optional(),
    finCode: z.string().optional(),
    passportNumber: z.string().optional(),
    issuingCountry: z.string().optional(),
  })
  .refine((d) => patientHasMdmIdentifier(d), {
    message: "Provide FIN, passport+country, or phone for MDM resolve",
  });

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    return jsonOk(await listPatients(q));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = createSchema.parse(await req.json());
    return jsonOk(await createPatient(body), 201);
  } catch (err) {
    if (err instanceof PatientMdmRequiredError) {
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
