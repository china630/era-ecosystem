import { z } from "zod";
import { linkPersonIdentity } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getRouteSession } from "@/lib/api-utils";

const schema = z.object({
  fin: z.string().trim().optional(),
  passport: z.string().trim().optional(),
  issuingCountry: z.string().trim().optional(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = schema.parse(await request.json());
    const linked = await linkPersonIdentity({
      fin: body.fin,
      passport: body.passport,
      issuingCountry: body.issuingCountry ?? body.nationality,
      fullName: body.fullName,
      phone: body.phone,
      nationality: body.nationality,
    });
    return jsonOk(linked);
  } catch (err) {
    return handleRouteError(err);
  }
}
