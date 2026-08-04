import { z } from "zod";
import { ClinicLookupKind } from "@prisma/client";
import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

const kindSchema = z.nativeEnum(ClinicLookupKind);

const createSchema = z.object({
  kind: kindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const url = new URL(req.url);
    const kindRaw = url.searchParams.get("kind");
    const activeOnly = url.searchParams.get("activeOnly") === "1";
    const kind = kindRaw ? kindSchema.parse(kindRaw) : undefined;
    const rows = await prisma.clinicLookup.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await prisma.clinicLookup.create({
      data: {
        kind: body.kind,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
