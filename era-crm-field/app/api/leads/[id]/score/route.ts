import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { computeLeadScore } from "@/lib/lead-score";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { visits: true },
    });
    if (!lead) return jsonError("Lead not found", 404);
    const score = computeLeadScore(lead);
    const updated = await prisma.lead.update({
      where: { id },
      data: { score, scoreUpdatedAt: new Date() },
      include: { owner: { select: { id: true, fullName: true } } },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
