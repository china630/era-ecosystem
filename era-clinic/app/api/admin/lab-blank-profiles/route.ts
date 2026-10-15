import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";
import { saveBlankProfile } from "@/domain/lab/blank-apply";
import { extractBlankTable } from "@/domain/lab/blank-docx";
import { ensureUrineBlankProfile } from "@/domain/lab/urine-blank";

const saveSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["TABLE", "NARRATIVE"]).default("TABLE"),
  serviceCode: z.string().nullable().optional(),
  rows: z.array(z.object({ sourceLabel: z.string().min(1), analyteCode: z.string().min(1) })),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    await ensureUrineBlankProfile();
    const [profiles, analytes] = await Promise.all([
      prisma.labBlankProfile.findMany({
        where: { active: true },
        include: { rows: { orderBy: { sortOrder: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.diagnosticAnalyte.findMany({
        select: { code: true, labelAz: true, labelEn: true, labelRu: true },
        orderBy: { code: "asc" },
      }),
    ]);
    const seen = new Set<string>();
    const analyteOptions = analytes.flatMap((row) => {
      if (seen.has(row.code)) return [];
      seen.add(row.code);
      const label = row.labelAz || row.labelEn || row.code;
      return [{ value: row.code, label: `${label} (${row.code})` }];
    });
    return jsonOk({ profiles, analyteOptions });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = saveSchema.parse(await req.json());
    return jsonOk(await saveBlankProfile(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Read a sample docx into label rows so an admin can map them. Does not invent analyte codes. */
export async function PUT(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonOk({ rows: [] });
    const rows = extractBlankTable(Buffer.from(await file.arrayBuffer()));
    return jsonOk({ rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
