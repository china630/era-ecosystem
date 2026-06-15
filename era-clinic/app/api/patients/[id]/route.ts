import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import {
  getPatient,
  updatePatient,
  PatientMdmRequiredError,
} from "@/domain/patient/patient.service";

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  finCode: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
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
    if (err instanceof PatientMdmRequiredError) {
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
