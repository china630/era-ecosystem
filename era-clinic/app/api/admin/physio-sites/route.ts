import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { createPhysioSite, listPhysioSites } from "@/domain/physio/physio-catalog.service";

const createSchema = z.object({
  code: z.string().min(1),
  kind: z.enum(["USSR-817", "SHCHERBAK", "HYDRO", "LOCAL"]),
  prikaz817: z.number().int().nullable().optional(),
  laterality: z.boolean().optional(),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  titleLa: z.string().min(1),
  boundary: z.string().nullable().optional(),
  coarse: z.array(z.string()).min(1),
  anatomyJson: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const rows = await listPhysioSites({
      q: url.searchParams.get("q") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createPhysioSite(body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioSite",
      row.id,
      "CREATE",
      { code: row.code },
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
