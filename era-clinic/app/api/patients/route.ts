import { z } from "zod";

import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";

import {

  listPatients,

  createPatient,

  PatientMdmRequiredError,

} from "@/domain/patient/patient.service";



const createSchema = z

  .object({

    refCode: z.string().min(1),

    fullName: z.string().min(1),

    phone: z.string().optional(),

    finCode: z.string().optional(),

    passportNumber: z.string().optional(),

    issuingCountry: z.string().optional(),

  })

  .refine(

    (d) =>

      Boolean(d.finCode?.trim()) ||

      (Boolean(d.passportNumber?.trim()) && Boolean(d.issuingCountry?.trim())) ||

      Boolean(d.phone?.trim()),

    { message: "Provide FIN, passport+country, or phone for MDM resolve" },

  );



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

