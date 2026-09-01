import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1),
  format: z.enum(["CSV", "HL7_FRAGMENT"]).default("CSV"),
  delimiter: z.string().default(","),
  columnMapping: z.record(z.string()).default({}),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const profiles = await prisma.lisFileProfile.findMany({
      orderBy: { name: "asc" },
    });
    return jsonOk(profiles);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    const profile = await prisma.lisFileProfile.create({
      data: {
        name: body.name,
        format: body.format,
        delimiter: body.delimiter,
        columnMapping: JSON.stringify(body.columnMapping),
      },
    });
    return jsonOk(profile, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
