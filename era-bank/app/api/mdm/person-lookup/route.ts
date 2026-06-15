import { z } from "zod";
import { linkPersonIdentity } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const schema = z.object({
  fin: z.string().trim().optional(),
  passport: z.string().trim().optional(),
  issuingCountry: z.string().trim().optional(),
  fullName: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const linked = await linkPersonIdentity({
      fin: body.fin,
      passport: body.passport,
      issuingCountry: body.issuingCountry,
      fullName: body.fullName,
    });
    return jsonOk(linked);
  } catch (err) {
    return handleRouteError(err);
  }
}
