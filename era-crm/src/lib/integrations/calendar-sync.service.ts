/**
 * Push open CRM tasks to Google / M365 calendars (TZ T-I28 lite).
 */
import {
  createHttpClient,
  gcalUpsertEvent,
  ms365UpsertEvent,
} from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import { resolveSecrets } from "@/lib/integrations/connections.service";

export async function syncOpenTasksToCalendars(): Promise<number> {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      enabled: true,
      providerKey: { in: ["gcal", "ms365_calendar"] },
    },
    take: 20,
  });
  if (!connections.length) return 0;
  let synced = 0;
  for (const connection of connections) {
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: connection.organizationId,
        doneAt: null,
        dueAt: { not: null },
      },
      take: 100,
      orderBy: { dueAt: "asc" },
    });
    const secrets = resolveSecrets(connection);
    const ctx = {
      connectionId: connection.id,
      organizationId: connection.organizationId,
      config: JSON.parse(connection.configJson || "{}"),
      secrets,
      webhookUrl: "",
      webhookSecret: "",
      http: createHttpClient(),
      log: console,
    };
    const routing = JSON.parse(connection.routingJson || "{}") as Record<
      string,
      string
    >;
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const startIso = task.dueAt.toISOString();
      const endIso = new Date(task.dueAt.getTime() + 30 * 60_000).toISOString();
      const externalId = routing[`task:${task.id}`];
      try {
        const result =
          connection.providerKey === "gcal"
            ? await gcalUpsertEvent(ctx, {
                id: externalId,
                summary: task.title,
                description: task.leadId ? `Lead ${task.leadId}` : undefined,
                startIso,
                endIso,
              })
            : await ms365UpsertEvent(ctx, {
                id: externalId,
                summary: task.title,
                description: task.leadId ? `Lead ${task.leadId}` : undefined,
                startIso,
                endIso,
              });
        if (result.externalId) {
          routing[`task:${task.id}`] = result.externalId;
          synced += 1;
        }
      } catch (err) {
        await prisma.integrationConnection.update({
          where: { id: connection.id },
          data: {
            lastError: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { routingJson: JSON.stringify(routing), lastEventAt: new Date() },
    });
  }
  return synced;
}
