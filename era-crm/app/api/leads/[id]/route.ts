import { jsonOk, jsonError, handleRouteError, assertCrmEntitled } from "@/lib/api-utils";
import { computeLeadScore } from "@/lib/lead-score";
import { updateLeadSchema, toPrismaPartyData } from "@/lib/lead-schemas";
import { syncContactRef, validatePartyForStage } from "@/lib/lead-party";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCrmEntitled();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, fullName: true, login: true } },
        visits: { orderBy: { visitedAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
        importBatch: { select: { id: true, fileName: true, createdAt: true } },
      },
    });
    if (!lead) return jsonError("Lead not found", 404);
    const score =
      lead.scoreUpdatedAt != null ? lead.score : computeLeadScore(lead);
    return jsonOk({ ...lead, score });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCrmEntitled();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    const body = updateLeadSchema.parse(await req.json());
    const partyData = toPrismaPartyData(body, {
      partyKind: lead.partyKind,
      channel: lead.channel,
      prospectType: lead.prospectType,
    });

    const merged = {
      ...lead,
      ...partyData,
      contactRef:
        body.contactRef !== undefined
          ? syncContactRef(
              body.contactRef,
              partyData.contactPhone ?? lead.contactPhone ?? undefined,
              body.channel ?? lead.channel,
            )
          : lead.contactRef,
      title: body.title ?? lead.title,
    };

    const gateError = validatePartyForStage(
      {
        partyKind: merged.partyKind,
        taxId: merged.taxId ?? null,
        companyName: merged.companyName ?? null,
        contactPhone: merged.contactPhone ?? null,
        stage: merged.stage,
      },
      lead.stage,
    );
    if (gateError) return jsonError(gateError, 400);

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.contactRef !== undefined
          ? { contactRef: merged.contactRef }
          : {}),
        ...partyData,
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
