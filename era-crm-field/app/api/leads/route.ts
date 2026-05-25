import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1),
  contactRef: z.string().min(1),
  stage: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional(),
  channel: z
    .enum(["whatsapp", "instagram", "visit", "phone", "other"])
    .optional(),
  estimatedAmount: z.number().optional(),
});

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return jsonOk(leads);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const stage = body.stage ?? "NEW";
    const lead = await prisma.lead.create({
      data: {
        title: body.title,
        contactRef: body.contactRef,
        stage,
        channel: body.channel ?? "other",
        estimatedAmount: body.estimatedAmount,
        stageHistory: {
          create: { toStage: stage },
        },
      },
    });
    return jsonOk(lead, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
