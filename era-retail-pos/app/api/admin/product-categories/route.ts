import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";

const writeSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  revenueCode: z.string().max(32).nullable().optional(),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const rows = await prisma.productCategory.findMany({ orderBy: { code: "asc" } });
    return jsonOk({ categories: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = writeSchema.parse(await req.json());
    const row = await prisma.productCategory.create({
      data: {
        organizationId: requestOrganizationId(),
        code: body.code.trim(),
        name: body.name.trim(),
        revenueCode: body.revenueCode?.trim() || null,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
