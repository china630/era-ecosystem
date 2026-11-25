/**
 * ICS feed for open CRM tasks (catalog E4 / TZ T-I28 P0 slice).
 */
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function buildTasksIcsByToken(token: string): Promise<string | null> {
  const connections = await prisma.integrationConnection.findMany({
    where: { providerKey: "ics_feed", enabled: true },
    take: 50,
  });
  let matched: (typeof connections)[number] | null = null;
  for (const c of connections) {
    const secrets = resolveSecrets(c);
    if (secrets.feedToken && secrets.feedToken === token) {
      matched = c;
      break;
    }
  }
  if (!matched) return null;

  const config = JSON.parse(matched.configJson || "{}") as { horizonDays?: string };
  const horizon = Math.min(90, Math.max(1, Number(config.horizonDays ?? 30)));
  const until = new Date(Date.now() + horizon * 86400_000);
  const tasks = await prisma.task.findMany({
    where: {
      organizationId: matched.organizationId,
      doneAt: null,
      OR: [{ dueAt: null }, { dueAt: { lte: until } }],
    },
    orderBy: { dueAt: "asc" },
    take: 500,
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ERA CRM//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const task of tasks) {
    const start = task.dueAt ?? task.createdAt ?? new Date();
    const end = new Date(start.getTime() + 30 * 60_000);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${task.id}@era-crm`);
    lines.push(`DTSTAMP:${toIcsUtc(new Date())}`);
    lines.push(`DTSTART:${toIcsUtc(start)}`);
    lines.push(`DTEND:${toIcsUtc(end)}`);
    lines.push(`SUMMARY:${icsEscape(task.title || task.type || "Task")}`);
    if (task.leadId) {
      lines.push(`DESCRIPTION:${icsEscape(`Lead ${task.leadId}`)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
