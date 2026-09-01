import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  bodyJson: z.string().default("{}"),
});

/** Legacy clinical-templates CRUD — gated by screen:admin.templates. */
export async function GET(req: Request) {
  try {
    const gate = await assertOpsApiPermission(req);
    if (gate.error) return gate.error;

    const templates = await prisma.clinicalTemplate.findMany({
      orderBy: { code: "asc" },
    });
    return jsonOk({ templates });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await assertOpsApiPermission(req);
    if (gate.error) return gate.error;

    const body = bodySchema.parse(await req.json());
    const row = await prisma.clinicalTemplate.create({ data: body });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
