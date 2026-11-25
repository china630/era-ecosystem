import type { NormalizedEvent } from "@era/integrations-kit";
import {
  SATELLITE_CRM_CALL_ENDED,
  SATELLITE_CRM_CALL_STARTED,
  SATELLITE_CRM_LEAD_CAPTURED,
  SATELLITE_CRM_MESSAGE_RECEIVED,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

function e164(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("994")) return `+${digits}`;
  if (digits.length === 9) return `+994${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function isHttpUrl(value?: string | null): boolean {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

async function resolvePlayableRecordingUrl(
  ref: string | undefined,
  resolveRecording?: (ref: string) => Promise<{ url?: string } | null | undefined>,
): Promise<string | undefined> {
  if (!ref?.trim()) return undefined;
  const trimmed = ref.trim();
  if (isHttpUrl(trimmed)) return trimmed;
  if (!resolveRecording) return undefined;
  try {
    const got = await resolveRecording(trimmed);
    const url = got?.url?.trim();
    return isHttpUrl(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

export async function applyNormalizedEvents(input: {
  organizationId: string;
  connectionId: string;
  channel: string;
  events: NormalizedEvent[];
  /** Resolve vendor recording id → playable HTTPS URL (TelephonyAdapter.fetchRecording). */
  resolveRecording?: (ref: string) => Promise<{ url?: string } | null | undefined>;
}): Promise<{ createdLeadIds: string[]; messageIds: string[]; callIds: string[] }> {
  const createdLeadIds: string[] = [];
  const messageIds: string[] = [];
  const callIds: string[] = [];

  for (const ev of input.events) {
    if (ev.kind === "message.in") {
      const phone = e164(ev.contact.phone);
      let lead = phone
        ? await prisma.lead.findFirst({
            where: { organizationId: input.organizationId, contactPhone: phone },
          })
        : null;
      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            organizationId: input.organizationId,
            title: ev.contact.name || phone || ev.chatId,
            contactRef: phone || ev.chatId,
            contactPhone: phone,
            channel: "other",
            isUnsorted: true,
            sourceRef: `${input.channel}:${ev.chatId}`,
          },
        });
        createdLeadIds.push(lead.id);
      }
      const conversation = await prisma.conversation.upsert({
        where: {
          connectionId_externalChatId: {
            connectionId: input.connectionId,
            externalChatId: ev.chatId,
          },
        },
        create: {
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          channel: input.channel,
          externalChatId: ev.chatId,
          contactName: ev.contact.name,
          contactPhone: phone,
          contactHandle: ev.contact.handle,
          leadId: lead.id,
          lastInboundAt: new Date(ev.at),
          lastMessageAt: new Date(ev.at),
          unreadCount: 1,
        },
        update: {
          lastInboundAt: new Date(ev.at),
          lastMessageAt: new Date(ev.at),
          unreadCount: { increment: 1 },
          leadId: lead.id,
        },
      });
      const msg = await prisma.message.create({
        data: {
          organizationId: input.organizationId,
          conversationId: conversation.id,
          direction: "IN",
          type: ev.message.type || "text",
          text: ev.message.text,
          externalId: ev.message.externalId,
          status: "RECEIVED",
          payloadJson: JSON.stringify(ev.message.payload ?? {}),
          sentAt: new Date(ev.at),
        },
      });
      messageIds.push(msg.id);
      await prisma.activity.create({
        data: {
          organizationId: input.organizationId,
          leadId: lead.id,
          type: "MESSAGE",
          payloadJson: JSON.stringify({
            conversationId: conversation.id,
            messageId: msg.id,
            direction: "IN",
          }),
        },
      });
      try {
        await dispatchSatelliteEvent({
          organizationId: input.organizationId,
          type: SATELLITE_CRM_MESSAGE_RECEIVED,
          payload: {
            organizationId: input.organizationId,
            conversationId: conversation.id,
            messageId: msg.id,
            leadId: lead.id,
            channel: input.channel,
          },
        });
      } catch {
        /* event bus optional in local */
      }
      try {
        const { applyAllPipelineRules } = await import(
          "@/lib/integrations/pipeline-lite.service"
        );
        await applyAllPipelineRules({
          organizationId: input.organizationId,
          leadId: lead.id,
          trigger: "MESSAGE_IN",
          conversationId: conversation.id,
          connectionId: input.connectionId,
        });
      } catch {
        /* pipeline lite optional */
      }
      try {
        const { dispatchOutboundWebhook } = await import(
          "@/lib/integrations/outbound-webhooks.service"
        );
        await dispatchOutboundWebhook({
          organizationId: input.organizationId,
          event: "crm.message.received",
          payload: {
            conversationId: conversation.id,
            messageId: msg.id,
            leadId: lead.id,
            channel: input.channel,
          },
        });
      } catch {
        /* outbound webhooks optional */
      }
    }

    if (ev.kind === "message.status" && ev.externalId) {
      await prisma.message.updateMany({
        where: {
          organizationId: input.organizationId,
          externalId: ev.externalId,
        },
        data: { status: ev.status as never },
      });
    }

    if (ev.kind === "lead.captured") {
      const phone = e164(ev.contact.phone || ev.fields.phone);
      const lead = await prisma.lead.create({
        data: {
          organizationId: input.organizationId,
          title: ev.contact.name || ev.fields.name || phone || "Inbound lead",
          contactRef: phone || ev.contact.email || "form",
          contactPhone: phone,
          contactEmail: ev.contact.email || ev.fields.email,
          channel: "other",
          isUnsorted: true,
          sourceRef: ev.source,
        },
      });
      createdLeadIds.push(lead.id);
      try {
        const { dispatchOutboundWebhook } = await import(
          "@/lib/integrations/outbound-webhooks.service"
        );
        await dispatchOutboundWebhook({
          organizationId: input.organizationId,
          event: "crm.lead.captured",
          payload: { leadId: lead.id, source: ev.source },
        });
      } catch {
        /* optional */
      }
      await prisma.activity.create({
        data: {
          organizationId: input.organizationId,
          leadId: lead.id,
          type: "SYSTEM",
          payloadJson: JSON.stringify({ kind: "lead.captured", fields: ev.fields, utm: ev.utm }),
        },
      });
      try {
        await dispatchSatelliteEvent({
          organizationId: input.organizationId,
          type: SATELLITE_CRM_LEAD_CAPTURED,
          payload: {
            organizationId: input.organizationId,
            leadId: lead.id,
            source: ev.source,
          },
        });
      } catch {
        /* optional */
      }
    }

    if (
      ev.kind === "call.ringing" ||
      ev.kind === "call.answered" ||
      ev.kind === "call.ended" ||
      ev.kind === "call.missed"
    ) {
      const phone = e164(ev.call.fromNumber);
      let lead = phone
        ? await prisma.lead.findFirst({
            where: { organizationId: input.organizationId, contactPhone: phone },
          })
        : null;
      if (!lead && phone) {
        lead = await prisma.lead.create({
          data: {
            organizationId: input.organizationId,
            title: phone,
            contactRef: phone,
            contactPhone: phone,
            channel: "phone",
            isUnsorted: true,
            sourceRef: `call:${ev.call.externalCallId}`,
          },
        });
        createdLeadIds.push(lead.id);
      }
      const status =
        ev.kind === "call.missed"
          ? "MISSED"
          : ev.kind === "call.answered"
            ? "ANSWERED"
            : ev.kind === "call.ringing"
              ? "RINGING"
              : "COMPLETED";
      const recordingUrl = await resolvePlayableRecordingUrl(
        ev.call.recordingUrl,
        input.resolveRecording,
      );
      const call = await prisma.call.upsert({
        where: {
          connectionId_externalCallId: {
            connectionId: input.connectionId,
            externalCallId: ev.call.externalCallId,
          },
        },
        create: {
          organizationId: input.organizationId,
          connectionId: input.connectionId,
          externalCallId: ev.call.externalCallId,
          direction: ev.call.direction,
          status: status as never,
          fromNumber: ev.call.fromNumber,
          toNumber: ev.call.toNumber,
          extension: ev.call.extension,
          leadId: lead?.id,
          durationSec: ev.call.durationSec,
          recordingUrl: recordingUrl ?? null,
          startedAt: new Date(ev.at),
        },
        update: {
          status: status as never,
          durationSec: ev.call.durationSec,
          ...(recordingUrl ? { recordingUrl } : {}),
          endedAt: ev.kind === "call.ended" || ev.kind === "call.missed" ? new Date(ev.at) : undefined,
        },
      });
      callIds.push(call.id);
      if (lead) {
        await prisma.activity.create({
          data: {
            organizationId: input.organizationId,
            leadId: lead.id,
            type: "CALL",
            payloadJson: JSON.stringify({ callId: call.id, kind: ev.kind }),
          },
        });
        if (ev.kind === "call.missed") {
          let assigneeId: string | undefined;
          const ext = ev.call.extension?.trim();
          if (ext) {
            const map = await prisma.userTelephonyExtension.findFirst({
              where: {
                organizationId: input.organizationId,
                connectionId: input.connectionId,
                extension: ext,
              },
            });
            assigneeId = map?.userId;
          }
          await prisma.task.create({
            data: {
              organizationId: input.organizationId,
              leadId: lead.id,
              type: "CALLBACK",
              title: `Call back ${phone ?? lead.title}`,
              dueAt: new Date(),
              assigneeId: assigneeId ?? undefined,
            },
          });
        }
      }
      try {
        await dispatchSatelliteEvent({
          organizationId: input.organizationId,
          type:
            ev.kind === "call.ringing"
              ? SATELLITE_CRM_CALL_STARTED
              : SATELLITE_CRM_CALL_ENDED,
          payload: {
            organizationId: input.organizationId,
            callId: call.id,
            leadId: lead?.id,
            fromNumber: ev.call.fromNumber,
            status,
          },
        });
      } catch {
        /* optional */
      }
      if (ev.kind === "call.ended" || ev.kind === "call.missed") {
        try {
          const { dispatchOutboundWebhook } = await import(
            "@/lib/integrations/outbound-webhooks.service"
          );
          await dispatchOutboundWebhook({
            organizationId: input.organizationId,
            event: ev.kind === "call.missed" ? "crm.call.missed" : "crm.call.ended",
            payload: {
              callId: call.id,
              leadId: lead?.id,
              fromNumber: ev.call.fromNumber,
              status,
            },
          });
        } catch {
          /* optional */
        }
      }
    }

    if (ev.kind === "call.recording") {
      const recordingUrl = await resolvePlayableRecordingUrl(
        ev.url,
        input.resolveRecording,
      );
      if (!recordingUrl) continue;
      const updated = await prisma.call.updateMany({
        where: {
          connectionId: input.connectionId,
          externalCallId: ev.externalCallId,
        },
        data: { recordingUrl },
      });
      if (updated.count === 0) {
        const created = await prisma.call.create({
          data: {
            organizationId: input.organizationId,
            connectionId: input.connectionId,
            externalCallId: ev.externalCallId,
            direction: "INBOUND",
            status: "COMPLETED",
            recordingUrl,
            startedAt: new Date(ev.at),
            endedAt: new Date(ev.at),
          },
        });
        callIds.push(created.id);
      } else {
        const existing = await prisma.call.findFirst({
          where: {
            connectionId: input.connectionId,
            externalCallId: ev.externalCallId,
          },
          select: { id: true },
        });
        if (existing) callIds.push(existing.id);
      }
    }
  }

  return { createdLeadIds, messageIds, callIds };
}
