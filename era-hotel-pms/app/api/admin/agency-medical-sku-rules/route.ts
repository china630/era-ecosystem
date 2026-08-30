import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { serialize } from "@/lib/serialize";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  listAgencyMedicalSkuRules,
  retireAgencyMedicalSkuRule,
  upsertAgencyMedicalSkuRule,
} from "@/lib/services/agency-medical-sku-rules.service";

const schema = z.object({
  id: z.string().uuid().optional(),
  agencyNamePrefix: z.string().min(1),
  packageCode: z.string().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    return jsonOk(serialize(await listAgencyMedicalSkuRules()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await upsertAgencyMedicalSkuRule(body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("id required");
    await retireAgencyMedicalSkuRule(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
