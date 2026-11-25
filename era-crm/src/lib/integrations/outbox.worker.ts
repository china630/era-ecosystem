/**
 * Integration outbound worker (TZ T-I06).
 * Without REDIS_URL: in-process interval.
 * With REDIS_URL: BullMQ-only (no parallel setInterval drain — audit v2 §5).
 */
import {
  getAdapter,
  createHttpClient,
  decryptSecretsJson,
} from "@era/integrations-kit";
import type { MessagingAdapter, TelephonyAdapter } from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";
import { checkRateLimit } from "@/lib/integrations/rate-limiter";

const MAX_ATTEMPTS = 6;

export async function processOutboxBatch(limit = 20): Promise<number> {
  const rows = await prisma.integrationOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let done = 0;
  for (const row of rows) {
    // Atomic claim — only one worker proceeds (inbound-style).
    const claimed = await prisma.integrationOutbox.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    try {
      const connection = await prisma.integrationConnection.findUnique({
        where: { id: row.connectionId },
      });
      if (!connection?.enabled) throw new Error("connection disabled");
      const adapter = getAdapter(connection.providerKey);
      if (!adapter) throw new Error("adapter missing");
      const secrets = resolveSecrets(connection);
      const rate = adapter.manifest.rateLimit ?? { perSecond: 10 };
      const allowed = await checkRateLimit(
        `out:${connection.id}`,
        rate.perSecond ?? 10,
      );
      if (!allowed) {
        await prisma.integrationOutbox.update({
          where: { id: row.id },
          data: {
            status: "PENDING",
            nextAttemptAt: new Date(Date.now() + 1000),
            lastError: "rate_limited",
          },
        });
        continue;
      }
      const ctx = {
        connectionId: connection.id,
        organizationId: connection.organizationId,
        config: JSON.parse(connection.configJson || "{}"),
        secrets,
        webhookUrl: "",
        webhookSecret: secrets.webhookSecret ?? "",
        http: createHttpClient(),
        log: console,
      };
      const payload = JSON.parse(row.payloadJson || "{}") as Record<string, unknown>;

      if (row.kind === "send_message" || row.kind === "sendText") {
        const messaging = adapter as MessagingAdapter;
        if (typeof messaging.sendMessage !== "function") {
          throw new Error(`sendMessage not implemented for ${connection.providerKey}`);
        }
        const result = await messaging.sendMessage(ctx, {
          chatId: String(payload.chatId ?? ""),
          type: String(payload.type ?? "text"),
          text: payload.text ? String(payload.text) : undefined,
          templateName: payload.templateName
            ? String(payload.templateName)
            : undefined,
          payload,
        });
        if (payload.messageId) {
          await prisma.message.updateMany({
            where: {
              id: String(payload.messageId),
              organizationId: connection.organizationId,
              status: "QUEUED",
            },
            data: { status: "SENT", externalId: result.externalId },
          });
        } else if (payload.conversationId) {
          const queued = await prisma.message.findFirst({
            where: {
              conversationId: String(payload.conversationId),
              status: "QUEUED",
            },
            orderBy: { sentAt: "desc" },
          });
          if (queued) {
            await prisma.message.update({
              where: { id: queued.id },
              data: { status: "SENT", externalId: result.externalId },
            });
          }
        }
      } else if (row.kind === "originate_call") {
        const telephony = adapter as TelephonyAdapter;
        if (typeof telephony.originateCall !== "function") {
          throw new Error(`originateCall not implemented for ${connection.providerKey}`);
        }
        await telephony.originateCall(ctx, {
          fromExtension: String(payload.fromExtension ?? ""),
          to: String(payload.to ?? ""),
        });
      } else {
        throw new Error(`unsupported outbox kind: ${row.kind}`);
      }

      await prisma.integrationOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          resultJson: JSON.stringify({ ok: true }),
          lastError: null,
        },
      });
      done += 1;
    } catch (err) {
      const fresh = await prisma.integrationOutbox.findUnique({
        where: { id: row.id },
        select: { attempts: true },
      });
      const attempts = fresh?.attempts ?? row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const dead = attempts >= MAX_ATTEMPTS;
      const delaySec = Math.min(160, 5 * 2 ** Math.max(0, attempts - 1));
      await prisma.integrationOutbox.update({
        where: { id: row.id },
        data: {
          status: dead ? "DEAD" : "PENDING",
          lastError: message,
          nextAttemptAt: new Date(Date.now() + delaySec * 1000),
        },
      });
      if (/401|403/.test(message)) {
        await prisma.integrationConnection.update({
          where: { id: row.connectionId },
          data: { status: "ERROR", lastError: message, enabled: false },
        });
      }
    }
  }
  return done;
}

/** Cron: strip PII from raw inbound bodies older than 30 days (field: receivedAt). */
export async function purgeInboundRawBodies(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86400_000);
  const res = await prisma.inboundEvent.updateMany({
    where: { receivedAt: { lt: cutoff }, rawBody: { not: "" } },
    data: { rawBody: "" },
  });
  return res.count;
}

let loopStarted = false;

export function startOutboxWorkerLoop(intervalMs = 2000): void {
  if (loopStarted) return;
  loopStarted = true;

  // PII retention always (independent of drain mode).
  setInterval(
    () => {
      void purgeInboundRawBodies().catch((err) =>
        console.error("[outbox] purgeInboundRawBodies", err),
      );
    },
    6 * 3600_000,
  );

  const url = process.env.REDIS_URL?.trim();
  if (url) {
    void startBullMqOnly(url);
    return;
  }

  const tick = async () => {
    try {
      await processOutboxBatch(25);
    } catch (err) {
      console.error("[outbox]", err);
    }
  };
  void tick();
  setInterval(() => void tick(), intervalMs);
}

async function startBullMqOnly(url: string): Promise<void> {
  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url };
    const queue = new Queue("integration-outbound", { connection });
    await queue.add(
      "drain",
      {},
      { repeat: { every: 2000 }, removeOnComplete: true, removeOnFail: 50 },
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _worker = new Worker(
      "integration-outbound",
      async () => {
        await processOutboxBatch(25);
      },
      { connection },
    );
    console.log("[outbox] BullMQ-only integration-outbound (no setInterval drain)");
  } catch (err) {
    console.warn("[outbox] BullMQ failed; falling back to in-process loop", err);
    const tick = async () => {
      try {
        await processOutboxBatch(25);
      } catch (e) {
        console.error("[outbox]", e);
      }
    };
    void tick();
    setInterval(() => void tick(), 2000);
  }
}

void decryptSecretsJson;
