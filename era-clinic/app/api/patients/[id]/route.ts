import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import {
  getPatient,
  updatePatient,
  PatientMdmRequiredError,
  PatientAnamnesisRequiredError,
} from "@/domain/patient/patient.service";

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

const updateSchema = z.object({
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
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
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
    if (!session) return jsonError("Unauthorized", 401);
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
