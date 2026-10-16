import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";
import { deleteBlankProfile, saveBlankProfile } from "@/domain/lab/blank-apply";
import { extractBlankTable } from "@/domain/lab/blank-docx";
import { ensureUrineBlankProfile } from "@/domain/lab/urine-blank";

const saveSchema = z.object({
  id: z.string().optional(),
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
    const [profiles, services] = await Promise.all([
      prisma.labBlankProfile.findMany({
        include: { rows: { orderBy: { sortOrder: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.diagnosticService.findMany({
        where: { active: true, analytes: { some: {} } },
        select: {
          id: true,
          code: true,
          serviceCode: true,
          category: true,
          titleAz: true,
          titleRu: true,
          titleEn: true,
          analytes: {
            orderBy: { sortOrder: "asc" },
            select: { code: true, labelAz: true, labelEn: true, labelRu: true },
          },
        },
        orderBy: [{ category: "asc" }, { titleAz: "asc" }],
      }),
    ]);
    return jsonOk({ profiles, panels: services });
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

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return jsonError("id required", 400);
    await deleteBlankProfile(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
