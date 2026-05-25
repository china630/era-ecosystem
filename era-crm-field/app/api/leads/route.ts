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
  ownerId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId");
    const mine = searchParams.get("mine") === "true";
    const userId = req.headers.get("x-user-id");

    const where =
      mine && userId
        ? { ownerId: userId }
        : ownerId
          ? { ownerId }
          : undefined;

    const leads = await prisma.lead.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, login: true } },
      },
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
        ownerId: body.ownerId,
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
