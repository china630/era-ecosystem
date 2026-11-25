/**
 * Legacy InboxThread API — dual-read Conversation first (T-I02 cutover).
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type LegacyInboxRow = {
  id: string;
  organizationId: string;
  channel: string;
  externalRef: string;
  leadId: string | null;
  preview: string | null;
  lastMessageAt: Date;
  lead?: { id: string; title: string; contactRef: string } | null;
  _source?: "conversation" | "inbox_thread";
};

export async function listInboxThreadsRecent(
  limit = 100,
  where?: Prisma.InboxThreadWhereInput & Record<string, unknown>,
): Promise<LegacyInboxRow[]> {
  const organizationId =
    typeof where?.organizationId === "string" ? where.organizationId : undefined;

  if (organizationId) {
    const convWhere: Prisma.ConversationWhereInput = {
      organizationId,
      ...(where?.OR ? { OR: where.OR as Prisma.ConversationWhereInput["OR"] } : {}),
    };
    const conversations = await prisma.conversation.findMany({
      where: convWhere,
      include: {
        lead: { select: { id: true, title: true, contactRef: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { text: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
    });
    if (conversations.length) {
      return conversations.map((c) => ({
        id: c.id,
        organizationId: c.organizationId,
        channel: c.channel,
        externalRef: c.externalChatId,
        leadId: c.leadId,
        preview: c.messages[0]?.text ?? c.contactName ?? null,
        lastMessageAt: c.lastMessageAt,
        lead: c.lead,
        _source: "conversation" as const,
      }));
    }
  }

  const threads = await prisma.inboxThread.findMany({
    where: where as Prisma.InboxThreadWhereInput | undefined,
    include: {
      lead: { select: { id: true, title: true, contactRef: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
  });
  return threads.map((t) => ({ ...t, _source: "inbox_thread" as const }));
}

export async function findLeadById(id: string, organizationId?: string) {
  return prisma.lead.findFirst({
    where: organizationId ? { id, organizationId } : { id },
  });
}

export async function createInboxThread(data: {
  organizationId: string;
  channel: string;
  externalRef: string;
  leadId?: string;
  preview?: string;
  lastMessageAt: Date;
}) {
  // Match channel → provider strictly (no cross-channel OR to whatsapp_cloud/instagram).
  const channelKey = data.channel.trim().toLowerCase();
  const providerKeys =
    channelKey === "whatsapp" || channelKey === "wa"
      ? ["whatsapp_cloud", "whatsapp", "wa_360dialog", "wazzup", "wa_twilio"]
      : channelKey === "instagram" || channelKey === "ig"
        ? ["instagram"]
        : [channelKey, data.channel];
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId: data.organizationId,
      enabled: true,
      providerKey: { in: providerKeys },
    },
    orderBy: { createdAt: "desc" },
  });

  if (connection) {
    const conversation = await prisma.conversation.upsert({
      where: {
        connectionId_externalChatId: {
          connectionId: connection.id,
          externalChatId: data.externalRef,
        },
      },
      create: {
        organizationId: data.organizationId,
        connectionId: connection.id,
        channel: data.channel,
        externalChatId: data.externalRef,
        leadId: data.leadId,
        lastMessageAt: data.lastMessageAt,
        contactName: data.preview ?? null,
      },
      update: {
        leadId: data.leadId,
        lastMessageAt: data.lastMessageAt,
      },
      include: {
        lead: { select: { id: true, title: true, contactRef: true } },
      },
    });
    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      channel: conversation.channel,
      externalRef: conversation.externalChatId,
      leadId: conversation.leadId,
      preview: data.preview ?? null,
      lastMessageAt: conversation.lastMessageAt,
      lead: conversation.lead,
      _source: "conversation" as const,
    };
  }

  // No connection yet — keep legacy row so data is not lost (deprecated path).
  return prisma.inboxThread.create({
    data: {
      organizationId: data.organizationId,
      channel: data.channel as "whatsapp" | "instagram",
      externalRef: data.externalRef,
      leadId: data.leadId,
      preview: data.preview,
      lastMessageAt: data.lastMessageAt,
    },
    include: {
      lead: { select: { id: true, title: true, contactRef: true } },
    },
  });
}
