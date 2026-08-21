import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, assertCrmEntitled } from "@/lib/api-utils";
import { computeLeadScore } from "@/lib/lead-score";
import {
  createLeadSchema,
  toPrismaPartyData,
} from "@/lib/lead-schemas";
import { syncContactRef } from "@/lib/lead-party";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await assertCrmEntitled();
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId");
    const mine = searchParams.get("mine") === "true";
    const prospectType = searchParams.get("prospectType");
    const userId = req.headers.get("x-user-id");

    const where: Record<string, unknown> = {};
    if (mine && userId) where.ownerId = userId;
    else if (ownerId) where.ownerId = ownerId;
    if (
      prospectType === "CUSTOMER" ||
      prospectType === "PARTNER" ||
      prospectType === "OTHER"
    ) {
      where.prospectType = prospectType;
    }

    const sort = searchParams.get("sort");
    const leads = await prisma.lead.findMany({
      where: Object.keys(where).length ? where : undefined,
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
    const raw = await req.json();
    const body = createLeadSchema.parse(raw);
    const stage = body.stage ?? "NEW";
    const channel = body.channel ?? "other";
    const partyData = toPrismaPartyData(body, { channel });
    const contactRef = syncContactRef(
      body.contactRef,
      partyData.contactPhone,
      channel,
    );
    if (!contactRef) {
      return jsonError("contactRef or contactPhone required", 400);
    }

    const lead = await prisma.lead.create({
      data: {
        title: body.title,
        contactRef,
        stage,
        channel,
        ...partyData,
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
