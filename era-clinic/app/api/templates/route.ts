import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.clinicalTemplate.findMany({ orderBy: { code: "asc" } });
    return jsonOk({ templates });
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  bodyJson: z.string().default("{}"),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const row = await prisma.clinicalTemplate.create({ data: body });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
