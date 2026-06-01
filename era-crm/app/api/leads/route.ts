import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { computeLeadScore } from "@/lib/lead-score";
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

    const sort = searchParams.get("sort");
    const leads = await prisma.lead.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, login: true } },
        visits: true,
      },
      orderBy: sort === "score" ? { score: "desc" } : { updatedAt: "desc" },
      take: 100,
    });
    const withScores = leads.map((l) => {
      const score =
        l.scoreUpdatedAt != null ? l.score : computeLeadScore(l);
      return { ...l, score };
    });
    return jsonOk(withScores);
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
