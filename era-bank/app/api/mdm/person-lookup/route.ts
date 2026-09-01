import { z } from "zod";
import {
  composePersonFullName,
  linkPersonIdentity,
  normalizeNationalityIso,
  resolveIncomingNameParts,
} from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: "fullName or firstName+lastName required" },
  );

/** Resolve MDM global person id from FIN / passport (CIF natural linkage). */
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const body = parsed.data;
    const parts = resolveIncomingNameParts(body);
    const fullName =
      composePersonFullName(parts?.firstName, parts?.middleName, parts?.lastName) ||
      body.fullName?.trim() ||
      "";
    const linked = await linkPersonIdentity({
      fin: body.fin,
      passport: body.passport,
      issuingCountry: body.issuingCountry,
      firstName: parts?.firstName?.trim() || undefined,
      middleName: parts?.middleName?.trim() || undefined,
      lastName: parts?.lastName?.trim() || undefined,
      fullName: fullName || undefined,
      phone: body.phone,
      nationality: normalizeNationalityIso(body.nationality) ?? undefined,
    });
    return jsonOk(linked);
  } catch (err) {
    return handleRouteError(err);
  }
}
