import { z } from "zod";
import { CrmLookupKind } from "@prisma/client";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const kindSchema = z.nativeEnum(CrmLookupKind);

const createSchema = z.object({
  kind: kindSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kindRaw = url.searchParams.get("kind");
    const activeOnly = url.searchParams.get("activeOnly") !== "0";
    const kind = kindRaw ? kindSchema.parse(kindRaw) : undefined;
    const rows = await prisma.crmLookup.findMany({
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
    const body = createSchema.parse(await req.json());
    const row = await prisma.crmLookup.create({
      data: {
        kind: body.kind,
        code: body.code.trim(),
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
