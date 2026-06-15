import { z } from "zod";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  listPractitioners,
  createPractitioner,
  auditMasterChange,
} from "@/lib/services/clinic-master-data.service";
import { linkPractitionerGlobalPerson } from "@/lib/practitioner-identity";

const createSchema = z.object({
  code: z.string().min(1),
  fullName: z.string().min(1),
  specialty: z.string().optional(),
  finCode: z.string().optional(),
  passportNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  phone: z.string().optional(),
  globalPersonId: z.string().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(240).optional(),
});

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    return jsonOk(await listPractitioners());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());

    const row = await createPractitioner({
      code: body.code,
      fullName: body.fullName,
      specialty: body.specialty,
      globalPersonId: body.globalPersonId ?? null,
      finCode: body.finCode ?? null,
      passportNumber: body.passportNumber ?? null,
      issuingCountry: body.issuingCountry ?? null,
      phone: body.phone ?? null,
      defaultSlotMinutes: body.defaultSlotMinutes,
    });

    await linkPractitionerGlobalPerson({
      practitionerId: row.id,
      fullName: body.fullName,
      fin: body.finCode,
      passport: body.passportNumber,
      issuingCountry: body.issuingCountry,
      phone: body.phone,
    });

    const refreshed = await listPractitioners().then((rows) =>
      rows.find((r) => r.id === row.id),
    );

    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitioner",
      row.id,
      "CREATE",
      body,
    );
    return jsonOk(refreshed ?? row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
