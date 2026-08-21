import { z } from "zod";
import { LeadStage } from "@prisma/client";
import { jsonOk, handleRouteError, assertCrmEntitled } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await assertCrmEntitled();
    const rules = await prisma.pipelineRule.findMany({ orderBy: { createdAt: "desc" } });
    return jsonOk({ rules });
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  triggerStage: z.nativeEnum(LeadStage).optional(),
  targetStage: z.nativeEnum(LeadStage),
});

export async function POST(req: Request) {
  try {
    await assertCrmEntitled();
    const body = bodySchema.parse(await req.json());
    const rule = await prisma.pipelineRule.create({ data: body });
    return jsonOk(rule, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
