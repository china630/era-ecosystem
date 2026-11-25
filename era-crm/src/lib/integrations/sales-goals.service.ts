/**
 * P1-9 Sales goals / KPI plan-fact (lite).
 */
import { prisma } from "@/lib/prisma";

export async function listSalesGoals(organizationId: string) {
  return prisma.salesGoal.findMany({
    where: { organizationId },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

export async function createSalesGoal(
  organizationId: string,
  data: {
    userId?: string;
    groupId?: string;
    periodStart: string;
    periodEnd: string;
    metric: string;
    targetValue: number;
  },
) {
  return prisma.salesGoal.create({
    data: {
      organizationId,
      userId: data.userId || null,
      groupId: data.groupId || null,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      metric: data.metric || "WON_COUNT",
      targetValue: data.targetValue,
    },
  });
}

export async function salesGoalFact(
  organizationId: string,
  goalId: string,
): Promise<{ target: number; fact: number; metric: string }> {
  const goal = await prisma.salesGoal.findFirst({
    where: { id: goalId, organizationId },
  });
  if (!goal) throw new Error("goal not found");
  const whereBase = {
    organizationId,
    convertedAt: {
      gte: goal.periodStart,
      lte: goal.periodEnd,
    },
    ...(goal.userId ? { ownerId: goal.userId } : {}),
  };
  let fact = 0;
  if (goal.metric === "WON_AMOUNT") {
    const agg = await prisma.lead.aggregate({
      where: { ...whereBase, stage: "WON" },
      _sum: { estimatedAmount: true },
    });
    fact = Number(agg._sum.estimatedAmount ?? 0);
  } else {
    fact = await prisma.lead.count({
      where: { ...whereBase, stage: "WON" },
    });
  }
  return {
    target: Number(goal.targetValue),
    fact,
    metric: goal.metric,
  };
}
