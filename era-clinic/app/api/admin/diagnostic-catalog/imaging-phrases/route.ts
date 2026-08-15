import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  createImagingPhrase,
  listImagingPhrases,
} from "@/domain/catalog/imaging-phrase.service";

const createSchema = z.object({
  organKey: z.string().min(1),
  code: z.string().min(1),
  textEn: z.string().min(1),
  textRu: z.string().min(1),
  textAz: z.string().min(1),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const organKey = url.searchParams.get("organKey") ?? undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return jsonOk(await listImagingPhrases({ organKey, includeInactive }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    return jsonOk(await createImagingPhrase(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
