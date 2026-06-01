import type { Lead, Visit } from "@prisma/client";

type LeadWithVisits = Lead & { visits?: Visit[] };

export function computeLeadScore(lead: LeadWithVisits): number {
  let score = 0;
  const stagePoints: Record<string, number> = {
    NEW: 10,
    CONTACTED: 25,
    QUALIFIED: 45,
    PROPOSAL: 65,
    WON: 100,
    LOST: 0,
  };
  score += stagePoints[lead.stage] ?? 10;
  if (lead.estimatedAmount && Number(lead.estimatedAmount) > 0) {
    score += Math.min(20, Math.floor(Number(lead.estimatedAmount) / 1000));
  }
  const visitCount = lead.visits?.length ?? 0;
  score += Math.min(15, visitCount * 5);
  if (lead.nextContactAt && lead.nextContactAt < new Date()) {
    score -= 10;
  }
  if (lead.channel === "whatsapp" || lead.channel === "instagram") {
    score += 5;
  }
  return Math.max(0, Math.min(100, score));
}
