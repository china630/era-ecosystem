/**
 * IMAP poller for email_imap_smtp connections (TZ T-I13).
 * Uses imapflow when installed; skips gracefully otherwise.
 */
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";
import { applyNormalizedEvents } from "@/lib/integrations/normalizer.service";
import type { NormalizedEvent } from "@era/integrations-kit";

const SEEN_KEY = "imapUidCursor";
const UID_VALIDITY_KEY = "imapUidValidity";

type ImapFlowModule = {
  ImapFlow: new (opts: Record<string, unknown>) => {
    connect: () => Promise<void>;
    logout: () => Promise<void>;
    getMailboxLock: (box: string) => Promise<{ release: () => void }>;
    mailbox?: { exists?: number; uidValidity?: number };
    fetch: (
      range: string,
      opts: Record<string, unknown>,
    ) => AsyncIterable<{
      uid?: number;
      envelope?: {
        from?: Array<{ name?: string; address?: string }>;
        subject?: string;
        date?: Date;
        messageId?: string;
      };
      source?: Buffer;
    }>;
  };
};

async function loadImapflow(): Promise<ImapFlowModule | null> {
  try {
    return (await import("imapflow")) as unknown as ImapFlowModule;
  } catch {
    return null;
  }
}

function parseFrom(raw: string | undefined): { email?: string; name?: string } {
  if (!raw) return {};
  const m = raw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (!m) return { email: raw.trim() };
  return { name: m[1]?.trim() || undefined, email: m[2]?.trim() };
}

export async function pollEmailConnections(): Promise<number> {
  const imapMod = await loadImapflow();
  if (!imapMod) {
    return 0;
  }
  const { ImapFlow } = imapMod;
  const connections = await prisma.integrationConnection.findMany({
    where: { providerKey: "email_imap_smtp", enabled: true },
    take: 20,
  });
  let applied = 0;
  for (const connection of connections) {
    const secrets = resolveSecrets(connection);
    const config = JSON.parse(connection.configJson || "{}") as Record<string, string>;
    const host = String(config.imapHost ?? "");
    const user = String(config.username ?? secrets.username ?? "");
    const pass = String(secrets.password ?? "");
    const port = Number(config.imapPort ?? 993);
    if (!host || !user || !pass) continue;

    const routing = JSON.parse(connection.routingJson || "{}") as Record<string, number>;
    let cursor = Number(routing[SEEN_KEY] ?? 0);
    let storedValidity = Number(routing[UID_VALIDITY_KEY] ?? 0);

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
    });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uidValidity = Number(client.mailbox?.uidValidity ?? 0);
        if (uidValidity && storedValidity && uidValidity !== storedValidity) {
          cursor = 0;
        }
        if (uidValidity) storedValidity = uidValidity;
        const exists = Number(client.mailbox?.exists ?? 0);
        if (exists <= cursor) {
          continue;
        }
        const fromUid = Math.max(1, cursor + 1);
        const events: NormalizedEvent[] = [];
        for await (const msg of client.fetch(`${fromUid}:*`, {
          uid: true,
          envelope: true,
          source: true,
        })) {
          const uid = Number(msg.uid ?? 0);
          if (uid > cursor) cursor = uid;
          const from = parseFrom(msg.envelope?.from?.[0]
            ? `${msg.envelope.from[0].name ?? ""} <${msg.envelope.from[0].address ?? ""}>`
            : undefined);
          const subject = msg.envelope?.subject ?? "(no subject)";
          const text = msg.source
            ? msg.source.toString("utf8").slice(0, 20_000)
            : subject;
          const messageId =
            msg.envelope?.messageId ||
            `imap-${connection.id}-${uid}`;
          events.push({
            kind: "message.in",
            at: (msg.envelope?.date ?? new Date()).toISOString(),
            chatId: from.email || `uid-${uid}`,
            contact: { email: from.email, name: from.name },
            message: {
              externalId: String(messageId),
              type: "text",
              text: `Subject: ${subject}\n\n${text}`,
            },
          });
        }
        if (events.length) {
          await applyNormalizedEvents({
            organizationId: connection.organizationId,
            connectionId: connection.id,
            channel: "email_imap_smtp",
            events,
          });
          applied += events.length;
        }
        await prisma.integrationConnection.update({
          where: { id: connection.id },
          data: {
            routingJson: JSON.stringify({
              ...routing,
              [SEEN_KEY]: cursor,
              [UID_VALIDITY_KEY]: storedValidity,
            }),
            lastEventAt: new Date(),
          },
        });
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { lastError: message.slice(0, 1000), status: "ERROR" },
      });
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
  }
  return applied;
}

let loopStarted = false;

export function startEmailPollerLoop(intervalMs = 60_000): void {
  if (loopStarted) return;
  loopStarted = true;
  const tick = async () => {
    try {
      await pollEmailConnections();
    } catch (err) {
      console.error("[email-poller]", err);
    }
  };
  void tick();
  setInterval(() => void tick(), intervalMs);
}
