import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  specialty: z.string().optional(),
  bodyJson: z.string().default("{}"),
});

export async function GET() {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    return jsonOk(await prisma.clinicalTemplate.findMany({ orderBy: { code: "asc" } }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    return jsonOk(await prisma.clinicalTemplate.create({ data: body }), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonOk({ error: "id required" }, 400);
    await prisma.clinicalTemplate.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
