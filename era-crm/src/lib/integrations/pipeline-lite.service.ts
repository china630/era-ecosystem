/**
 * Digital Pipeline lite (P1-1): evaluate ALL matching rules; optional actions.
 */
import { prisma } from "@/lib/prisma";

export type PipelineLiteTrigger =
  | "STAGE_ENTER"
  | "NO_ACTIVITY_X_HOURS"
  | "MESSAGE_IN"
  | "FIELD_CHANGED"
  | "SCHEDULE";

type ActionJson = {
  createTask?: { title?: string; type?: string; dueMinutes?: number };
  assignOwnerId?: string;
  addTag?: string;
  /** P2 bot lite — no visual builder; plain auto-reply text on MESSAGE_IN. */
  autoReply?: string;
};

export async function applyAllPipelineRules(input: {
  organizationId: string;
  leadId: string;
  trigger: PipelineLiteTrigger;
  fromStage?: string;
  /** Stage just entered (STAGE_ENTER match). Falls back to fromStage for older callers. */
  toStage?: string;
  conversationId?: string;
  connectionId?: string;
}): Promise<number> {
  const rules = await prisma.pipelineRule.findMany({
    where: {
      organizationId: input.organizationId,
      active: true,
      triggerType: input.trigger,
    },
  });

  let applied = 0;
  for (const rule of rules) {
    if (input.trigger === "STAGE_ENTER" && rule.triggerStage) {
      const entered = input.toStage ?? input.fromStage;
      if (entered && rule.triggerStage !== entered) {
        continue;
      }
    }

    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: input.organizationId },
    });
    if (!lead) continue;

    let actions: ActionJson = {};
    try {
      actions = JSON.parse(rule.actionJson || "{}") as ActionJson;
    } catch {
      actions = {};
    }

    const stageMoves = lead.stage !== rule.targetStage;
    if (stageMoves) {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: {
          stage: rule.targetStage,
          ...(actions.assignOwnerId ? { ownerId: actions.assignOwnerId } : {}),
        },
      });
      await prisma.leadStageHistory.create({
        data: {
          organizationId: input.organizationId,
          leadId: input.leadId,
          fromStage: lead.stage,
          toStage: rule.targetStage,
        },
      });
    } else if (actions.assignOwnerId) {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { ownerId: actions.assignOwnerId },
      });
    }

    if (actions.createTask?.title) {
      await prisma.task.create({
        data: {
          organizationId: input.organizationId,
          leadId: input.leadId,
          type: actions.createTask.type ?? "FOLLOW_UP",
          title: actions.createTask.title,
          dueAt: new Date(
            Date.now() + (actions.createTask.dueMinutes ?? 60) * 60_000,
          ),
          assigneeId: actions.assignOwnerId,
        },
      });
    }
    if (actions.addTag) {
      const tag = await prisma.tag.upsert({
        where: {
          organizationId_name: {
            organizationId: input.organizationId,
            name: actions.addTag,
          },
        },
        create: {
          organizationId: input.organizationId,
          name: actions.addTag,
        },
        update: {},
      });
      await prisma.leadTag.upsert({
        where: {
          leadId_tagId: { leadId: input.leadId, tagId: tag.id },
        },
        create: { leadId: input.leadId, tagId: tag.id },
        update: {},
      });
    }
    if (
      actions.autoReply?.trim() &&
      input.trigger === "MESSAGE_IN" &&
      input.conversationId &&
      input.connectionId
    ) {
      const text = actions.autoReply.trim();
      await prisma.message.create({
        data: {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          direction: "OUT",
          type: "text",
          text,
          status: "QUEUED",
          payloadJson: JSON.stringify({ botLite: true, ruleId: rule.id }),
        },
      });
      const idem = `botlite:${rule.id}:${input.conversationId}:${Date.now()}`;
      await prisma.integrationOutbox.create({
        data: {
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          kind: "sendText",
          idempotencyKey: idem,
          payloadJson: JSON.stringify({
            conversationId: input.conversationId,
            text,
          }),
          status: "PENDING",
        },
      });
      await prisma.activity.create({
        data: {
          organizationId: input.organizationId,
          leadId: input.leadId,
          type: "SYSTEM",
          payloadJson: JSON.stringify({
            action: "bot_lite_auto_reply",
            ruleId: rule.id,
          }),
        },
      });
    }
    applied += 1;
  }
  return applied;
}
