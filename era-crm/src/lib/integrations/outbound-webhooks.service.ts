/**
 * E14 / T-I29 — customer outbound webhooks with HMAC + retries.
 */
import { createHmac, randomBytes } from "node:crypto";
import { encryptSecretsJson, decryptSecretsJson, createHttpClient } from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";

const FAIL_DISABLE_AFTER = 10;

export async function listWebhookSubscriptions(organizationId: string) {
  const rows = await prisma.webhookSubscription.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    events: JSON.parse(r.eventsJson || "[]") as string[],
    active: r.active,
    failCount: r.failCount,
    createdAt: r.createdAt,
  }));
}

export async function createWebhookSubscription(input: {
  organizationId: string;
  url: string;
  events: string[];
  secret?: string;
}) {
  const secret = input.secret?.trim() || randomBytes(24).toString("base64url");
  const row = await prisma.webhookSubscription.create({
    data: {
      organizationId: input.organizationId,
      url: input.url,
      eventsJson: JSON.stringify(input.events),
      secretEnc: encryptSecretsJson({ signingSecret: secret }),
      active: true,
    },
  });
  return { id: row.id, url: row.url, events: input.events, secretOnce: secret };
}

function matchEvent(patterns: string[], event: string): boolean {
  return patterns.some((p) => {
    if (p === event) return true;
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -1);
      return event.startsWith(prefix);
    }
    return false;
  });
}

export async function dispatchOutboundWebhook(input: {
  organizationId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const subs = await prisma.webhookSubscription.findMany({
    where: { organizationId: input.organizationId, active: true },
  });
  const http = createHttpClient({ timeoutMs: 10_000, maxRetries: 0 });
  let sent = 0;
  for (const sub of subs) {
    const events = JSON.parse(sub.eventsJson || "[]") as string[];
    if (!matchEvent(events, input.event)) continue;
    let secret = "";
    try {
      secret = decryptSecretsJson(sub.secretEnc).signingSecret ?? "";
    } catch {
      continue;
    }
    const body = JSON.stringify({
      event: input.event,
      organizationId: input.organizationId,
      at: new Date().toISOString(),
      data: input.payload,
    });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    try {
      const res = await http.request({
        method: "POST",
        url: sub.url,
        headers: {
          "content-type": "application/json",
          "x-era-signature": sig,
          "x-era-event": input.event,
        },
        body, // exact bytes signed
      });
      if (res.status >= 300) throw new Error(`HTTP ${res.status}`);
      if (sub.failCount > 0) {
        await prisma.webhookSubscription.update({
          where: { id: sub.id },
          data: { failCount: 0 },
        });
      }
      sent += 1;
    } catch {
      const failCount = sub.failCount + 1;
      await prisma.webhookSubscription.update({
        where: { id: sub.id },
        data: {
          failCount,
          active: failCount < FAIL_DISABLE_AFTER,
        },
      });
    }
  }
  return sent;
}
