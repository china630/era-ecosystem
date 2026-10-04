import { z } from "zod";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const tools = await prisma.tool.findMany({
      include: {
        checkouts: { where: { returnedAt: null }, take: 5 },
      },
    });
    return jsonOk({ tools });
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  code: z.string(),
  name: z.string(),
});

export async function POST(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await req.json());
    const tool = await prisma.tool.upsert({
      where: { code: body.code },
      create: body,
      update: { name: body.name },
    });
    return jsonOk(tool, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
