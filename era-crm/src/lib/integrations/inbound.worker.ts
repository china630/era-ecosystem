/**
 * Integration inbound worker (TZ T-I05).
 * Hooks ACK quickly after InboundEvent insert; this worker normalizes + applies.
 */
import {
  getAdapter,
  createHttpClient,
} from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";
import { applyNormalizedEvents } from "@/lib/integrations/normalizer.service";

export async function processInboundBatch(limit = 25): Promise<number> {
  const rows = await prisma.inboundEvent.findMany({
    where: { status: "RECEIVED" },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });
  let done = 0;
  for (const row of rows) {
    const claimed = await prisma.inboundEvent.updateMany({
      where: { id: row.id, status: "RECEIVED" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) continue;
    try {
      const connection = await prisma.integrationConnection.findUnique({
        where: { id: row.connectionId },
      });
      if (!connection?.enabled) {
        throw new Error("connection disabled");
      }
      const adapter = getAdapter(connection.providerKey);
      if (!adapter) throw new Error("adapter missing");
      const secrets = resolveSecrets(connection);
      const headers = JSON.parse(row.headersJson || "{}") as Record<
        string,
        string | string[] | undefined
      >;
      const subPathRaw = headers["x-era-subpath"];
      const subPath = Array.isArray(subPathRaw)
        ? String(subPathRaw[0] ?? "")
        : String(subPathRaw ?? "");
      if (subPath) delete headers["x-era-subpath"];
      const contentTypeRaw = headers["x-era-content-type"];
      const contentType = Array.isArray(contentTypeRaw)
        ? String(contentTypeRaw[0] ?? "")
        : String(contentTypeRaw ?? "");
      if (contentType) delete headers["x-era-content-type"];
      const prefetchRaw = headers["x-era-prefetch-events"];
      let prefetchEvents: import("@era/integrations-kit").NormalizedEvent[] | null =
        null;
      if (prefetchRaw != null && String(prefetchRaw).trim()) {
        delete headers["x-era-prefetch-events"];
        try {
          const parsed = JSON.parse(
            Array.isArray(prefetchRaw) ? String(prefetchRaw[0]) : String(prefetchRaw),
          );
          if (Array.isArray(parsed)) prefetchEvents = parsed;
        } catch {
          prefetchEvents = null;
        }
      }
      const rawReq = {
        method: "POST",
        headers,
        rawBody: Buffer.from(row.rawBody || "", "utf8"),
        query: {},
        subPath: subPath || undefined,
        contentType: contentType || undefined,
      };
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
      const events =
        prefetchEvents ??
        ((await adapter.normalize?.(rawReq, ctx)) ?? []);
      const telephony = adapter as {
        fetchRecording?: (
          c: typeof ctx,
          ref: string,
        ) => Promise<{ url?: string; stream?: Buffer }>;
      };
      await applyNormalizedEvents({
        organizationId: connection.organizationId,
        connectionId: connection.id,
        channel: connection.providerKey,
        events,
        resolveRecording: telephony.fetchRecording
          ? async (ref) => telephony.fetchRecording!(ctx, ref)
          : undefined,
      });
      await prisma.inboundEvent.update({
        where: { id: row.id },
        data: { status: "PROCESSED", processedAt: new Date(), error: null },
      });
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastEventAt: new Date() },
      });
      done += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.inboundEvent.update({
        where: { id: row.id },
        data: { status: "ERROR", error: message.slice(0, 2000) },
      });
    }
  }
  return done;
}

let loopStarted = false;

export function startInboundWorkerLoop(intervalMs = 1500): void {
  if (loopStarted) return;
  loopStarted = true;
  const tick = async () => {
    try {
      await processInboundBatch(25);
    } catch (err) {
      console.error("[inbound]", err);
    }
  };
  void tick();
  setInterval(() => void tick(), intervalMs);
  void startBullMqIfConfigured();
}

async function startBullMqIfConfigured(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;
  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url };
    const queue = new Queue("integration-inbound", { connection });
    await queue.add(
      "drain",
      {},
      {
        // BullMQ JobScheduler / repeat — cast for installed typings variance
        repeat: { every: 1500 },
        removeOnComplete: true,
        removeOnFail: 50,
      } as never,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _worker = new Worker(
      "integration-inbound",
      async () => {
        await processInboundBatch(25);
      },
      { connection },
    );
    console.log("[inbound] BullMQ integration-inbound worker attached");
  } catch (err) {
    console.warn("[inbound] BullMQ unavailable, using in-process loop only", err);
  }
}

/** Enqueue hint for BullMQ when present (hooks stay fast). */
export async function enqueueInboundDrain(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;
  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue("integration-inbound", { connection: { url } });
    await queue.add("drain-once", {}, { removeOnComplete: true, removeOnFail: 20 });
  } catch {
    /* optional */
  }
}
