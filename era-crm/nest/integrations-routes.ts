import type { Express, Request as ExpressRequest, Response as ExpressResponse } from "express";
import {
  contentTypeFromRequest,
  getAdapter,
} from "@era/integrations-kit";
import { prisma } from "@/lib/prisma";
import {
  catalogForAdmin,
  createConnection,
  listConnections,
  resolveSecrets,
  setEnabled,
  testConnection,
} from "@/lib/integrations/connections.service";
import {
  acceptUnsortedLead,
  linkUnsortedLead,
  listUnsortedLeads,
  rejectUnsortedLead,
} from "@/lib/integrations/unsorted.service";
import {
  loadConvertSideEffects,
  saveConvertSideEffects,
  type ConvertSideEffects,
} from "@/lib/integrations/convert-settings";
import { enqueueInboundDrain } from "@/lib/integrations/inbound.worker";
import { getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { runWithNestHttp, runWithStaffTenantIfPresent, sendRouteError } from "./bridge";

/**
 * Staff session + RBAC (TZ T-I04). Never fall back to x-era-organization-id
 * after a permission failure — that bypassed grants (audit §5.1).
 */
async function withSession(
  httpReq: ExpressRequest,
  httpRes: ExpressResponse,
  fn: (
    organizationId: string,
    userId?: string,
    session?: Awaited<ReturnType<typeof getSatelliteSession>>,
  ) => Promise<unknown>,
) {
  try {
    const path = String(httpReq.originalUrl ?? httpReq.url ?? "").split("?")[0];
    if (!httpReq.headers["x-era-pathname"]) {
      httpReq.headers["x-era-pathname"] = path;
    }
    if (!httpReq.headers["x-era-method"]) {
      httpReq.headers["x-era-method"] = String(httpReq.method ?? "GET").toUpperCase();
    }
    await runWithNestHttp(httpReq, async () =>
      runWithStaffTenantIfPresent(httpReq, async () => {
        const session = await getSatelliteSession();
        if (!session) {
          httpRes.status(401).json({ error: "Unauthorized" });
          return;
        }
        const result = await fn(session.organizationId, session.sub, session);
        if (!httpRes.headersSent) httpRes.json(result);
      }),
    );
  } catch (err) {
    await sendRouteError(httpRes, err);
  }
}

async function requireLeadScope(
  organizationId: string,
  userId: string | undefined,
  leadId: string,
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  const { assertLeadInScope } = await import("@/lib/integrations/lead-scope");
  await assertLeadInScope({
    organizationId,
    userId: String(userId ?? ""),
    leadId,
    permissions: session?.permissions ?? [],
    isOwner: session?.isOwner === true,
  });
}

function requirePipelineAdmin(
  session: Awaited<ReturnType<typeof getSatelliteSession>>,
) {
  assertPermission(session, PERMISSIONS.ADMIN_PIPELINE);
}

export function registerIntegrationsRoutes(http: Express) {
  http.get("/api/integrations/catalog", (req, res) => {
    void withSession(req, res, async () => ({ items: catalogForAdmin() }));
  });

  http.get("/api/integrations/connections", (req, res) => {
    void withSession(req, res, async (organizationId) => ({
      items: await listConnections(organizationId),
    }));
  });

  http.post("/api/integrations/connections", (req, res) => {
    void withSession(req, res, async (organizationId, userId) => {
      const body = req.body as {
        providerKey?: string;
        displayName?: string;
        config?: Record<string, unknown>;
        secrets?: Record<string, string>;
      };
      return createConnection({
        organizationId,
        providerKey: String(body.providerKey ?? ""),
        displayName: String(body.displayName ?? ""),
        config: body.config,
        secrets: body.secrets,
        actorUserId: userId,
      });
    });
  });

  http.post("/api/integrations/connections/:id/test", (req, res) => {
    void withSession(req, res, async (organizationId, userId) =>
      testConnection(organizationId, String(req.params.id), userId),
    );
  });

  http.post("/api/integrations/connections/:id/enable", (req, res) => {
    void withSession(req, res, async (organizationId, userId) =>
      setEnabled(organizationId, String(req.params.id), true, userId),
    );
  });

  http.post("/api/integrations/connections/:id/disable", (req, res) => {
    void withSession(req, res, async (organizationId, userId) =>
      setEnabled(organizationId, String(req.params.id), false, userId),
    );
  });

  http.get("/api/integrations/connections/:id/extensions", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const connectionId = String(req.params.id);
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const items = await prisma.userTelephonyExtension.findMany({
        where: { organizationId, connectionId },
        orderBy: { extension: "asc" },
      });
      return { items };
    });
  });

  http.put("/api/integrations/connections/:id/extensions", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const connectionId = String(req.params.id);
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const body = req.body as {
        items?: Array<{ userId?: string; extension?: string }>;
      };
      const items = (body.items ?? [])
        .map((row) => ({
          userId: String(row.userId ?? "").trim(),
          extension: String(row.extension ?? "").trim(),
        }))
        .filter((row) => row.userId && row.extension);
      await prisma.$transaction(async (tx) => {
        await tx.userTelephonyExtension.deleteMany({
          where: { organizationId, connectionId },
        });
        if (items.length) {
          await tx.userTelephonyExtension.createMany({
            data: items.map((row) => ({
              organizationId,
              connectionId,
              userId: row.userId,
              extension: row.extension,
            })),
          });
        }
      });
      const saved = await prisma.userTelephonyExtension.findMany({
        where: { organizationId, connectionId },
        orderBy: { extension: "asc" },
      });
      return { items: saved };
    });
  });

  http.get("/api/admin/webhooks", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listWebhookSubscriptions } = await import(
        "@/lib/integrations/outbound-webhooks.service"
      );
      return { items: await listWebhookSubscriptions(organizationId) };
    });
  });

  http.post("/api/admin/webhooks", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = req.body as {
        url?: string;
        events?: string[];
        secret?: string;
      };
      const { createWebhookSubscription } = await import(
        "@/lib/integrations/outbound-webhooks.service"
      );
      return createWebhookSubscription({
        organizationId,
        url: String(body.url ?? ""),
        events: Array.isArray(body.events) ? body.events.map(String) : ["crm.lead.*"],
        secret: body.secret ? String(body.secret) : undefined,
      });
    });
  });

  http.get("/api/admin/api-keys", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listTenantApiKeys } = await import(
        "@/lib/integrations/tenant-api-keys.service"
      );
      return { items: await listTenantApiKeys(organizationId) };
    });
  });

  http.post("/api/admin/api-keys", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = req.body as {
        name?: string;
        scopes?: string[];
        expiresAt?: string;
      };
      const { createTenantApiKey } = await import(
        "@/lib/integrations/tenant-api-keys.service"
      );
      return createTenantApiKey({
        organizationId,
        name: String(body.name ?? "api-key"),
        scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : undefined,
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
      });
    });
  });

  http.delete("/api/admin/api-keys/:id", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { revokeTenantApiKey } = await import(
        "@/lib/integrations/tenant-api-keys.service"
      );
      return revokeTenantApiKey(organizationId, String(req.params.id));
    });
  });

  http.get("/api/integrations/oauth/meta/start", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const connectionId = String(req.query.connectionId ?? "");
      if (!connectionId) {
        res.status(400).json({ error: "connectionId required" });
        return null;
      }
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const { buildMetaOAuthUrl, metaAppCredentials } = await import(
        "@/lib/integrations/oauth-meta.service"
      );
      if (!metaAppCredentials()) {
        res.status(503).json({
          error: "META_APP_ID / META_APP_SECRET not configured on platform",
        });
        return null;
      }
      return {
        url: buildMetaOAuthUrl({ connectionId, organizationId }),
      };
    });
  });

  http.post("/api/integrations/oauth/meta/complete", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = req.body as { code?: string; state?: string };
      const { completeMetaOAuth } = await import(
        "@/lib/integrations/oauth-meta.service"
      );
      return completeMetaOAuth({
        code: String(body.code ?? ""),
        state: String(body.state ?? ""),
        organizationId,
      });
    });
  });

  http.post("/api/integrations/connections/:id/oauth/refresh", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { refreshMetaConnectionToken, metaAppCredentials } = await import(
        "@/lib/integrations/oauth-meta.service"
      );
      if (!metaAppCredentials()) {
        res.status(503).json({
          error: "META_APP_ID / META_APP_SECRET not configured on platform",
        });
        return null;
      }
      try {
        return await refreshMetaConnectionToken(
          String(req.params.id),
          organizationId,
        );
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Refresh failed",
        });
        return null;
      }
    });
  });

  http.get("/api/integrations/oauth/google/start", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const connectionId = String(req.query.connectionId ?? "");
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const {
        buildGoogleOAuthUrl,
        googleCreds,
      } = await import("@/lib/integrations/oauth-google-ms.service");
      if (!googleCreds()) {
        res.status(503).json({ error: "GOOGLE_OAUTH_CLIENT_ID/SECRET not configured" });
        return null;
      }
      const scopes =
        connection.providerKey === "gcal"
          ? ["https://www.googleapis.com/auth/calendar.events"]
          : ["https://www.googleapis.com/auth/gmail.modify"];
      return { url: buildGoogleOAuthUrl({ connectionId, organizationId, scopes }) };
    });
  });

  http.get("/api/integrations/oauth/microsoft/start", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const connectionId = String(req.query.connectionId ?? "");
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const {
        buildMicrosoftOAuthUrl,
        microsoftCreds,
      } = await import("@/lib/integrations/oauth-google-ms.service");
      if (!microsoftCreds()) {
        res.status(503).json({
          error: "MICROSOFT_OAUTH_CLIENT_ID/SECRET not configured",
        });
        return null;
      }
      const scopes =
        connection.providerKey === "ms365_calendar"
          ? ["Calendars.ReadWrite", "User.Read"]
          : ["Mail.ReadWrite", "Mail.Send", "User.Read"];
      return {
        url: buildMicrosoftOAuthUrl({ connectionId, organizationId, scopes }),
      };
    });
  });

  http.post("/api/integrations/oauth/google-ms/complete", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = req.body as { code?: string; state?: string };
      const { completeGoogleOrMsOAuth } = await import(
        "@/lib/integrations/oauth-google-ms.service"
      );
      return completeGoogleOrMsOAuth({
        code: String(body.code ?? ""),
        state: String(body.state ?? ""),
        organizationId,
      });
    });
  });

  http.get("/api/conversations", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const leadId =
        typeof req.query.leadId === "string" ? req.query.leadId.trim() : "";
      if (leadId) {
        await requireLeadScope(organizationId, userId, leadId, session);
        const items = await prisma.conversation.findMany({
          where: { organizationId, leadId },
          orderBy: { lastMessageAt: "desc" },
          take: 50,
        });
        return { items };
      }
      const { leadScopedRelationWhere } = await import(
        "@/lib/integrations/lead-scope"
      );
      const scopeWhere = await leadScopedRelationWhere({
        organizationId,
        userId: String(userId ?? ""),
        permissions: session?.permissions ?? [],
        isOwner: session?.isOwner === true,
        orphanAssignedField: "assigneeId",
      });
      const items = await prisma.conversation.findMany({
        where: scopeWhere as never,
        orderBy: { lastMessageAt: "desc" },
        take: 100,
      });
      return { items };
    });
  });

  http.get("/api/conversations/:id/messages", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const conversation = await prisma.conversation.findFirst({
        where: { id: String(req.params.id), organizationId },
      });
      if (!conversation) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      if (conversation.leadId) {
        await requireLeadScope(
          organizationId,
          userId,
          conversation.leadId,
          session,
        );
      } else {
        const {
          resolveLeadScopeFromGrants,
          assertOrphanRecordAccess,
        } = await import("@/lib/integrations/lead-scope");
        assertOrphanRecordAccess({
          scope: resolveLeadScopeFromGrants({
            permissions: session?.permissions ?? [],
            isOwner: session?.isOwner === true,
          }),
          userId: String(userId ?? ""),
          assigneeOrUserId: conversation.assigneeId,
        });
      }
      const items = await prisma.message.findMany({
        where: { organizationId, conversationId: conversation.id },
        orderBy: { sentAt: "asc" },
        take: 200,
      });
      return { items };
    });
  });

  http.post("/api/conversations/:id/messages", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const body = req.body as {
        text?: string;
        type?: string;
        templateName?: string;
      };
      const conversation = await prisma.conversation.findFirst({
        where: { id: String(req.params.id), organizationId },
      });
      if (!conversation) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      if (conversation.leadId) {
        await requireLeadScope(
          organizationId,
          userId,
          conversation.leadId,
          session,
        );
      } else {
        const {
          resolveLeadScopeFromGrants,
          assertOrphanRecordAccess,
        } = await import("@/lib/integrations/lead-scope");
        assertOrphanRecordAccess({
          scope: resolveLeadScopeFromGrants({
            permissions: session?.permissions ?? [],
            isOwner: session?.isOwner === true,
          }),
          userId: String(userId ?? ""),
          assigneeOrUserId: conversation.assigneeId,
        });
      }
      const isTemplate =
        body.type === "template" || Boolean(body.templateName?.trim());
      // Vendor 24h customer-care windows (WA + Meta messaging + Viber).
      const windowFamily =
        /whatsapp|wa_|wazzup|instagram|messenger|facebook|viber/i.test(
          conversation.channel,
        );
      if (windowFamily && !isTemplate) {
        const lastIn = conversation.lastInboundAt
          ? new Date(conversation.lastInboundAt).getTime()
          : 0;
        const WINDOW_MS = 24 * 60 * 60 * 1000;
        if (!lastIn || Date.now() - lastIn > WINDOW_MS) {
          res.status(400).json({
            error:
              "Outside 24h customer-care window; use a template or wait for inbound",
            code: "OUTSIDE_WINDOW",
          });
          return null;
        }
      }
      const msg = await prisma.message.create({
        data: {
          organizationId,
          conversationId: conversation.id,
          direction: "OUT",
          type: body.type ?? "text",
          text: body.text,
          status: "QUEUED",
          authorUserId: userId,
        },
      });
      const outbox = await prisma.integrationOutbox.create({
        data: {
          organizationId,
          connectionId: conversation.connectionId,
          kind: "send_message",
          idempotencyKey: `out:${msg.id}`,
          payloadJson: JSON.stringify({
            messageId: msg.id,
            conversationId: conversation.id,
            chatId: conversation.externalChatId,
            text: body.text,
            type: body.type ?? "text",
            templateName: isTemplate
              ? String(body.templateName ?? body.text ?? "")
              : undefined,
            authorUserId: userId,
          }),
        },
      });
      return { message: msg, outboxId: outbox.id };
    });
  });

  http.get("/api/calls", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const leadId =
        typeof req.query.leadId === "string" ? req.query.leadId : undefined;
      if (leadId) {
        await requireLeadScope(organizationId, userId, leadId, session);
        const items = await prisma.call.findMany({
          where: { organizationId, leadId },
          orderBy: { startedAt: "desc" },
          take: 100,
        });
        return { items };
      }
      const { leadScopedRelationWhere } = await import(
        "@/lib/integrations/lead-scope"
      );
      const scopeWhere = await leadScopedRelationWhere({
        organizationId,
        userId: String(userId ?? ""),
        permissions: session?.permissions ?? [],
        isOwner: session?.isOwner === true,
        orphanAssignedField: "userId",
      });
      const items = await prisma.call.findMany({
        where: scopeWhere as never,
        orderBy: { startedAt: "desc" },
        take: 100,
      });
      return { items };
    });
  });

  http.post("/api/calls/originate", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = req.body as {
        connectionId?: string;
        to?: string;
        fromExtension?: string;
      };
      if (!body.connectionId || !body.to?.trim()) {
        res.status(400).json({ error: "connectionId and to required" });
        return null;
      }
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          id: String(body.connectionId),
          organizationId,
          enabled: true,
        },
      });
      if (!connection) {
        res.status(404).json({ error: "Connection not found" });
        return null;
      }
      const outbox = await prisma.integrationOutbox.create({
        data: {
          organizationId,
          connectionId: connection.id,
          kind: "originate_call",
          idempotencyKey: `call:${body.to}:${Date.now()}`,
          payloadJson: JSON.stringify({
            connectionId: connection.id,
            to: body.to.trim(),
            fromExtension: body.fromExtension,
          }),
        },
      });
      return { outboxId: outbox.id, status: "QUEUED" };
    });
  });

  http.get("/api/tasks", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const {
        leadScopeWhere,
        resolveLeadScopeFromGrants,
      } = await import("@/lib/integrations/lead-scope");
      const scope = resolveLeadScopeFromGrants({
        permissions: session?.permissions ?? [],
        isOwner: session?.isOwner === true,
      });
      const leadWhere = await leadScopeWhere(
        organizationId,
        String(userId ?? ""),
        scope,
      );
      const uid = String(userId ?? "");
      const orphanClause =
        scope === "all"
          ? { leadId: null }
          : { leadId: null, assigneeId: uid };
      const items = await prisma.task.findMany({
        where: {
          organizationId,
          doneAt: null,
          OR: [
            orphanClause,
            { lead: leadWhere },
            { assigneeId: uid },
          ],
        },
        orderBy: { dueAt: "asc" },
        take: 100,
      });
      return { items };
    });
  });

  http.post("/api/tasks", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const body = req.body as {
        leadId?: string;
        title?: string;
        type?: string;
        dueAt?: string;
        assigneeId?: string;
      };
      if (body.leadId) {
        await requireLeadScope(
          organizationId,
          userId,
          body.leadId,
          session,
        );
      }
      return prisma.task.create({
        data: {
          organizationId,
          leadId: body.leadId,
          title: String(body.title ?? "Task"),
          type: body.type ?? "FOLLOW_UP",
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          assigneeId: body.assigneeId,
        },
      });
    });
  });

  http.patch("/api/tasks/:id/complete", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const body = req.body as { result?: string };
      const row = await prisma.task.findFirst({
        where: { id: String(req.params.id), organizationId },
      });
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      const uid = String(userId ?? "");
      const {
        resolveLeadScopeFromGrants,
        assertLeadInScope,
      } = await import("@/lib/integrations/lead-scope");
      const { PermissionDeniedError } = await import("@/lib/auth/require");
      const scope = resolveLeadScopeFromGrants({
        permissions: session?.permissions ?? [],
        isOwner: session?.isOwner === true,
      });
      const isAssignee = row.assigneeId != null && row.assigneeId === uid;
      if (row.leadId) {
        if (!isAssignee) {
          await assertLeadInScope({
            organizationId,
            userId: uid,
            leadId: row.leadId,
            permissions: session?.permissions ?? [],
            isOwner: session?.isOwner === true,
          });
        }
      } else if (!isAssignee && scope !== "all") {
        throw new PermissionDeniedError("Task not found or out of scope");
      }
      return prisma.task.update({
        where: { id: row.id },
        data: {
          doneAt: new Date(),
          result: body.result ?? "DONE",
        },
      });
    });
  });

  // Lightweight SSE for call ringing (TZ T-I16).
  http.get("/api/realtime/calls", (req, res) => {
    void (async () => {
      try {
        const path = String(req.originalUrl ?? req.url ?? "").split("?")[0];
        req.headers["x-era-pathname"] = path;
        req.headers["x-era-method"] = "GET";
        await runWithNestHttp(req, async () =>
          runWithStaffTenantIfPresent(req, async () => {
            const session = await getSatelliteSession();
            if (!session) {
              res.status(401).json({ error: "Unauthorized" });
              return;
            }
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });
            const send = async () => {
              const {
                leadScopedRelationWhere,
              } = await import("@/lib/integrations/lead-scope");
              const scopeWhere = await leadScopedRelationWhere({
                organizationId: session.organizationId,
                userId: String(session.sub ?? ""),
                permissions: session.permissions ?? [],
                isOwner: session.isOwner === true,
                orphanAssignedField: "userId",
              });
              const ringing = await prisma.call.findMany({
                where: {
                  ...(scopeWhere as object),
                  status: "RINGING",
                  startedAt: { gte: new Date(Date.now() - 60_000) },
                },
                orderBy: { startedAt: "desc" },
                take: 5,
              });
              res.write(`data: ${JSON.stringify({ items: ringing })}\n\n`);
            };
            await send();
            const timer = setInterval(() => void send(), 2000);
            req.on("close", () => clearInterval(timer));
          }),
        );
      } catch (err) {
        await sendRouteError(res, err);
      }
    })();
  });

  http.get("/api/leads/:id/activities", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const { assertLeadInScope } = await import("@/lib/integrations/lead-scope");
      await assertLeadInScope({
        organizationId,
        userId: String(userId ?? ""),
        leadId: String(req.params.id),
        permissions: session?.permissions ?? [],
        isOwner: session?.isOwner === true,
      });
      const items = await prisma.activity.findMany({
        where: { organizationId, leadId: String(req.params.id) },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { items };
    });
  });

  http.get("/api/reports/funnel", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const pipelineId =
        typeof req.query.pipelineId === "string" && req.query.pipelineId.trim()
          ? req.query.pipelineId.trim()
          : undefined;
      const leadFilter = {
        organizationId,
        isUnsorted: false,
        ...(pipelineId ? { pipelineId } : {}),
      };
      const history = await prisma.leadStageHistory.groupBy({
        by: ["toStage"],
        where: {
          organizationId,
          ...(pipelineId
            ? { lead: { pipelineId } }
            : {}),
        },
        _count: { _all: true },
      });
      const currentStages = await prisma.lead.groupBy({
        by: ["stage"],
        where: leadFilter,
        _count: { _all: true },
      });
      const currentPipelineStages = pipelineId
        ? await prisma.lead.groupBy({
            by: ["stageId"],
            where: leadFilter,
            _count: { _all: true },
          })
        : [];
      const unsorted = await prisma.lead.count({
        where: {
          organizationId,
          isUnsorted: true,
          ...(pipelineId ? { pipelineId } : {}),
        },
      });

      // Avg hours spent before entering each toStage (capped; see historyCapped).
      const HISTORY_CAP = 20_000;
      const recentHistory = await prisma.leadStageHistory.findMany({
        where: {
          organizationId,
          ...(pipelineId ? { lead: { pipelineId } } : {}),
        },
        orderBy: [{ leadId: "asc" }, { changedAt: "asc" }],
        take: HISTORY_CAP,
        select: { leadId: true, toStage: true, changedAt: true },
      });
      const historyCapped = recentHistory.length >= HISTORY_CAP;
      const hoursByStage: Record<string, number[]> = {};
      let prev: { leadId: string; changedAt: Date } | null = null;
      for (const row of recentHistory) {
        if (prev && prev.leadId === row.leadId) {
          const hours =
            (row.changedAt.getTime() - prev.changedAt.getTime()) / 3_600_000;
          if (hours >= 0 && hours < 24 * 365) {
            (hoursByStage[row.toStage] ??= []).push(hours);
          }
        }
        prev = { leadId: row.leadId, changedAt: row.changedAt };
      }
      const avgHoursInStage = Object.entries(hoursByStage).map(
        ([stage, vals]) => ({
          stage,
          avgHours:
            vals.length === 0
              ? null
              : Math.round(
                  (vals.reduce((a, b) => a + b, 0) / vals.length) * 10,
                ) / 10,
          sampleSize: vals.length,
        }),
      );

      // First response: one batched message query (no N+1).
      const conversations = await prisma.conversation.findMany({
        where: { organizationId },
        select: { id: true },
        take: 200,
        orderBy: { lastMessageAt: "desc" },
      });
      const convIds = conversations.map((c) => c.id);
      const firstResponseMinutes: number[] = [];
      if (convIds.length) {
        const msgs = await prisma.message.findMany({
          where: { organizationId, conversationId: { in: convIds } },
          orderBy: [{ conversationId: "asc" }, { sentAt: "asc" }],
          select: {
            conversationId: true,
            direction: true,
            sentAt: true,
          },
        });
        const byConv = new Map<
          string,
          Array<{ direction: string; sentAt: Date }>
        >();
        for (const m of msgs) {
          const list = byConv.get(m.conversationId) ?? [];
          if (list.length < 40) list.push(m);
          byConv.set(m.conversationId, list);
        }
        for (const id of convIds) {
          const list = byConv.get(id) ?? [];
          const firstIn = list.find((m) => m.direction === "IN");
          if (!firstIn) continue;
          const firstOut = list.find(
            (m) =>
              m.direction === "OUT" &&
              m.sentAt.getTime() >= firstIn.sentAt.getTime(),
          );
          if (!firstOut) continue;
          const mins =
            (firstOut.sentAt.getTime() - firstIn.sentAt.getTime()) / 60_000;
          if (mins >= 0 && mins < 60 * 24 * 30) firstResponseMinutes.push(mins);
        }
      }
      const avgFirstResponseMinutes =
        firstResponseMinutes.length === 0
          ? null
          : Math.round(
              (firstResponseMinutes.reduce((a, b) => a + b, 0) /
                firstResponseMinutes.length) *
                10,
            ) / 10;

      return {
        stageCounts: history,
        currentStageCounts: currentStages,
        currentPipelineStageCounts: currentPipelineStages,
        pipelineId: pipelineId ?? null,
        unsorted,
        avgHoursInStage,
        avgFirstResponseMinutes,
        firstResponseSampleSize: firstResponseMinutes.length,
        historySampleSize: recentHistory.length,
        historyCapped,
        historyCap: HISTORY_CAP,
      };
    });
  });

  // —— Pipelines / stages (P0-5) ——
  http.get("/api/pipelines", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listPipelines } = await import(
        "@/lib/integrations/pipelines.service"
      );
      return { items: await listPipelines(organizationId) };
    });
  });

  http.post("/api/pipelines", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const body = (req.body ?? {}) as { name?: string; isDefault?: boolean };
      try {
        const { createPipeline } = await import(
          "@/lib/integrations/pipelines.service"
        );
        return await createPipeline(organizationId, {
          name: String(body.name ?? ""),
          isDefault: body.isDefault,
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Create failed",
        });
        return null;
      }
    });
  });

  http.patch("/api/pipelines/:id", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const body = (req.body ?? {}) as { name?: string; isDefault?: boolean };
      const { patchPipeline } = await import(
        "@/lib/integrations/pipelines.service"
      );
      const row = await patchPipeline(
        organizationId,
        String(req.params.id),
        body,
      );
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      return row;
    });
  });

  http.post("/api/pipelines/:id/stages", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const body = (req.body ?? {}) as {
        name?: string;
        sortOrder?: number;
        color?: string;
        kind?: "OPEN" | "WON" | "LOST";
        legacyStage?: string;
      };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "name required" });
        return null;
      }
      const { addStage } = await import(
        "@/lib/integrations/pipelines.service"
      );
      const row = await addStage(organizationId, String(req.params.id), {
        name: body.name,
        sortOrder: body.sortOrder,
        color: body.color,
        kind: body.kind,
        legacyStage: body.legacyStage as never,
      });
      if (!row) {
        res.status(404).json({ error: "Pipeline not found" });
        return null;
      }
      return row;
    });
  });

  http.patch("/api/pipelines/:id/stages/:stageId", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const body = (req.body ?? {}) as {
        name?: string;
        sortOrder?: number;
        color?: string | null;
        kind?: "OPEN" | "WON" | "LOST";
      };
      const { patchStage } = await import(
        "@/lib/integrations/pipelines.service"
      );
      const row = await patchStage(
        organizationId,
        String(req.params.stageId),
        body,
      );
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return null;
      }
      return row;
    });
  });

  http.delete("/api/pipelines/:id/stages/:stageId", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const { deleteStage } = await import(
        "@/lib/integrations/pipelines.service"
      );
      const result = await deleteStage(
        organizationId,
        String(req.params.stageId),
      );
      if (!result.ok) {
        res.status(result.reason === "has_leads" ? 409 : 404).json({
          error:
            result.reason === "has_leads"
              ? "Stage has leads"
              : "Not found",
          code: result.reason,
        });
        return null;
      }
      return { ok: true };
    });
  });

  http.post("/api/pipelines/templates/:vertical", (req, res) => {
    void withSession(req, res, async (organizationId, _userId, session) => {
      requirePipelineAdmin(session);
      const vertical = String(req.params.vertical ?? "").toLowerCase();
      const { seedVerticalTemplate } = await import(
        "@/lib/integrations/pipelines.service"
      );
      try {
        return await seedVerticalTemplate(
          organizationId,
          vertical as "clinic" | "hotel" | "construction",
        );
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid vertical",
        });
        return null;
      }
    });
  });

  // Dedicated prefix — avoid clashing with generated `/api/leads/:id`.
  http.get("/api/unsorted", (req, res) => {
    void withSession(req, res, async (organizationId) => ({
      items: await listUnsortedLeads(organizationId),
    }));
  });

  http.post("/api/unsorted/:id/accept", (req, res) => {
    void withSession(req, res, async (organizationId, userId) => {
      const updated = await acceptUnsortedLead({
        organizationId,
        leadId: String(req.params.id),
        actorUserId: String(userId ?? ""),
      });
      if (!updated) {
        res.status(404).json({ error: "Unsorted lead not found" });
        return null;
      }
      return updated;
    });
  });

  http.post("/api/unsorted/:id/link", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const body = req.body as { targetLeadId?: string };
      if (!body.targetLeadId) {
        res.status(400).json({ error: "targetLeadId required" });
        return null;
      }
      await requireLeadScope(
        organizationId,
        userId,
        String(body.targetLeadId),
        session,
      );
      try {
        const result = await linkUnsortedLead({
          organizationId,
          leadId: String(req.params.id),
          targetLeadId: String(body.targetLeadId),
          actorUserId: String(userId ?? ""),
        });
        if (!result) {
          res.status(404).json({ error: "Lead not found" });
          return null;
        }
        return result;
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Link failed",
        });
        return null;
      }
    });
  });

  http.post("/api/unsorted/:id/reject", (req, res) => {
    void withSession(req, res, async (organizationId, userId) => {
      const updated = await rejectUnsortedLead({
        organizationId,
        leadId: String(req.params.id),
        actorUserId: String(userId ?? ""),
      });
      if (!updated) {
        res.status(404).json({ error: "Unsorted lead not found" });
        return null;
      }
      return updated;
    });
  });

  http.get("/api/admin/convert-settings", (req, res) => {
    void withSession(req, res, async (organizationId) =>
      loadConvertSideEffects(organizationId),
    );
  });

  http.patch("/api/admin/convert-settings", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = (req.body ?? {}) as Partial<ConvertSideEffects>;
      return saveConvertSideEffects(organizationId, body);
    });
  });

  // —— Product P1: Contact / Company / merge / custom fields / sales goals ——
  http.get("/api/companies", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listCompanies } = await import("@/lib/integrations/party-entities.service");
      return { items: await listCompanies(organizationId) };
    });
  });

  http.post("/api/companies", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = (req.body ?? {}) as { name?: string; taxId?: string };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "name required" });
        return null;
      }
      const { createCompany } = await import("@/lib/integrations/party-entities.service");
      return createCompany(organizationId, {
        name: body.name,
        taxId: body.taxId,
      });
    });
  });

  http.get("/api/contacts", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const companyId =
        typeof req.query.companyId === "string" ? req.query.companyId : undefined;
      const { listContacts } = await import("@/lib/integrations/party-entities.service");
      return { items: await listContacts(organizationId, companyId) };
    });
  });

  http.post("/api/contacts", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = (req.body ?? {}) as {
        fullName?: string;
        phone?: string;
        email?: string;
        companyId?: string;
        globalPersonId?: string;
      };
      if (!body.fullName?.trim()) {
        res.status(400).json({ error: "fullName required" });
        return null;
      }
      const { createContact } = await import("@/lib/integrations/party-entities.service");
      return createContact(organizationId, {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        companyId: body.companyId,
        globalPersonId: body.globalPersonId,
      });
    });
  });

  http.post("/api/leads/merge", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      const body = (req.body ?? {}) as {
        survivorLeadId?: string;
        duplicateLeadId?: string;
      };
      if (!body.survivorLeadId || !body.duplicateLeadId) {
        res.status(400).json({ error: "survivorLeadId and duplicateLeadId required" });
        return null;
      }
      await requireLeadScope(
        organizationId,
        userId,
        body.survivorLeadId,
        session,
      );
      await requireLeadScope(
        organizationId,
        userId,
        body.duplicateLeadId,
        session,
      );
      try {
        const { mergeLeads } = await import("@/lib/integrations/party-entities.service");
        return await mergeLeads({
          organizationId,
          survivorLeadId: body.survivorLeadId,
          duplicateLeadId: body.duplicateLeadId,
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Merge failed",
        });
        return null;
      }
    });
  });

  http.get("/api/custom-fields", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const entity =
        typeof req.query.entity === "string" ? req.query.entity : "LEAD";
      const { listCustomFieldDefs } = await import(
        "@/lib/integrations/custom-fields.service"
      );
      return { items: await listCustomFieldDefs(organizationId, entity) };
    });
  });

  http.put("/api/custom-fields", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = (req.body ?? {}) as {
        entity?: string;
        key?: string;
        label?: string;
        fieldType?: string;
        options?: string[];
        requiredOnStageIds?: string[];
      };
      if (!body.key?.trim() || !body.label?.trim() || !body.fieldType?.trim()) {
        res.status(400).json({ error: "key, label, fieldType required" });
        return null;
      }
      const { upsertCustomFieldDef } = await import(
        "@/lib/integrations/custom-fields.service"
      );
      return upsertCustomFieldDef(organizationId, {
        entity: body.entity,
        key: body.key.trim(),
        label: body.label.trim(),
        fieldType: body.fieldType.trim(),
        options: body.options,
        requiredOnStageIds: body.requiredOnStageIds,
      });
    });
  });

  http.patch("/api/leads/:id/custom", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      const body = (req.body ?? {}) as { custom?: Record<string, unknown> };
      if (!body.custom || typeof body.custom !== "object") {
        res.status(400).json({ error: "custom object required" });
        return null;
      }
      try {
        const { setLeadCustomJson } = await import(
          "@/lib/integrations/custom-fields.service"
        );
        return await setLeadCustomJson(
          organizationId,
          String(req.params.id),
          body.custom,
        );
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  http.get("/api/tags", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listTags } = await import("@/lib/integrations/custom-fields.service");
      return { items: await listTags(organizationId) };
    });
  });

  http.get("/api/leads/:id/tags", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      try {
        const { listLeadTags } = await import(
          "@/lib/integrations/custom-fields.service"
        );
        return {
          items: await listLeadTags(organizationId, String(req.params.id)),
        };
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  http.post("/api/leads/:id/tags", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      const body = (req.body ?? {}) as { name?: string };
      if (!body.name?.trim()) {
        res.status(400).json({ error: "name required" });
        return null;
      }
      try {
        const { addLeadTag } = await import(
          "@/lib/integrations/custom-fields.service"
        );
        return await addLeadTag(
          organizationId,
          String(req.params.id),
          body.name.trim(),
        );
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  http.delete("/api/leads/:id/tags/:tagId", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      try {
        const { removeLeadTag } = await import(
          "@/lib/integrations/custom-fields.service"
        );
        return await removeLeadTag(
          organizationId,
          String(req.params.id),
          String(req.params.tagId),
        );
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  http.get("/api/sales-goals", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const { listSalesGoals } = await import(
        "@/lib/integrations/sales-goals.service"
      );
      return { items: await listSalesGoals(organizationId) };
    });
  });

  http.post("/api/sales-goals", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      const body = (req.body ?? {}) as {
        userId?: string;
        groupId?: string;
        periodStart?: string;
        periodEnd?: string;
        metric?: string;
        targetValue?: number;
      };
      if (!body.periodStart || !body.periodEnd || body.targetValue == null) {
        res.status(400).json({
          error: "periodStart, periodEnd, targetValue required",
        });
        return null;
      }
      const { createSalesGoal } = await import(
        "@/lib/integrations/sales-goals.service"
      );
      return createSalesGoal(organizationId, {
        userId: body.userId,
        groupId: body.groupId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        metric: body.metric || "WON_COUNT",
        targetValue: Number(body.targetValue),
      });
    });
  });

  http.get("/api/leads/:id/payment", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      const lead = await prisma.lead.findFirst({
        where: { id: String(req.params.id), organizationId },
        select: { customJson: true },
      });
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return null;
      }
      const { readPaymentFromCustomJson } = await import(
        "@/lib/integrations/payment-status.service"
      );
      return readPaymentFromCustomJson(lead.customJson);
    });
  });

  http.patch("/api/leads/:id/payment", (req, res) => {
    void withSession(req, res, async (organizationId, userId, session) => {
      await requireLeadScope(
        organizationId,
        userId,
        String(req.params.id),
        session,
      );
      const body = (req.body ?? {}) as {
        paymentStatus?: string;
        paymentLink?: string;
      };
      if (!body.paymentStatus?.trim()) {
        res.status(400).json({ error: "paymentStatus required" });
        return null;
      }
      try {
        const { setLeadPaymentStatus } = await import(
          "@/lib/integrations/payment-status.service"
        );
        return await setLeadPaymentStatus(
          organizationId,
          String(req.params.id),
          body.paymentStatus.trim(),
          body.paymentLink,
        );
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  http.get("/api/sales-goals/:id/fact", (req, res) => {
    void withSession(req, res, async (organizationId) => {
      try {
        const { salesGoalFact } = await import(
          "@/lib/integrations/sales-goals.service"
        );
        return await salesGoalFact(organizationId, String(req.params.id));
      } catch (err) {
        res.status(404).json({
          error: err instanceof Error ? err.message : "Not found",
        });
        return null;
      }
    });
  });

  // Public ICS feed (token in path) — no session.
  // Accept /api/integrations/ics/:token and /api/integrations/ics/:token.ics
  http.get(
    "/api/integrations/ics/:token",
    async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const { buildTasksIcsByToken } = await import(
          "@/lib/integrations/ics-feed.service"
        );
        const raw = String(req.params.token ?? "").replace(/\.ics$/i, "");
        const ics = await buildTasksIcsByToken(raw);
        if (!ics) {
          res.status(404).type("text/plain").send("Not found");
          return;
        }
        res
          .status(200)
          .type("text/calendar; charset=utf-8")
          .setHeader("Cache-Control", "no-store")
          .send(ics);
      } catch (err) {
        await sendRouteError(res, err);
      }
    },
  );

  // Math captcha challenge for public webchat / form widgets (P1-5 / v4 §5.2).
  http.get(
    "/api/integrations/hooks/:providerKey/:publicId/challenge",
    async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const providerKey = String(req.params.providerKey);
        const publicId = String(req.params.publicId);
        // Uniform 404 — no enum of enabled publicIds / unsupported providers.
        if (providerKey !== "webchat" && providerKey !== "form_generic") {
          res.status(404).json({ error: "Not found" });
          return;
        }
        const {
          assertPublicRateLimit,
          issueMathChallenge,
        } = await import("@/lib/integrations/public-hook-guard");
        const ip =
          String(req.headers["x-forwarded-for"] ?? "")
            .split(",")[0]
            ?.trim() ||
          req.socket.remoteAddress ||
          "unknown";
        // RL by IP only — do not key on publicId (enumeration oracle).
        const rl = assertPublicRateLimit(
          `challenge:${providerKey}:${ip}`,
          20,
          60_000,
        );
        if (!rl.ok) {
          res
            .status(429)
            .setHeader("Retry-After", String(rl.retryAfterSec))
            .json({ error: "Rate limit exceeded", code: "RATE_LIMIT" });
          return;
        }
        // Always 200 + challenge shape for supported providers (no 200/404 oracle).
        // POST still 404s unknown publicId; captcha alone is not enough.
        void publicId;
        res.status(200).json(issueMathChallenge());
      } catch (err) {
        await sendRouteError(res, err);
      }
    },
  );

  async function handlePublicIntegrationHook(
    req: ExpressRequest,
    res: ExpressResponse,
  ) {
    try {
      const providerKey = String(req.params.providerKey);
      const publicId = String(req.params.publicId);
      const pathOnly = String(req.originalUrl ?? req.url ?? "").split("?")[0];
      const hookPrefix = `/api/integrations/hooks/${providerKey}/${publicId}`;
      let subPath = "";
      if (pathOnly.length > hookPrefix.length + 1 && pathOnly.startsWith(hookPrefix + "/")) {
        subPath = pathOnly.slice(hookPrefix.length + 1);
      }
      const wildcard = req.params[0];
      if (!subPath && typeof wildcard === "string" && wildcard.trim()) {
        subPath = String(wildcard).replace(/^\/+/, "");
      }

      const connection = await prisma.integrationConnection.findFirst({
        where: { publicId, providerKey, enabled: true },
      });
      if (!connection) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const adapter = getAdapter(providerKey);
      if (!adapter) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const captured = (req as ExpressRequest & { rawBody?: Buffer }).rawBody;
      const rawBody =
        Buffer.isBuffer(captured) && captured.length
          ? captured
          : Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(
                typeof req.body === "string"
                  ? req.body
                  : JSON.stringify(req.body ?? {}),
              );
      const query = Object.fromEntries(
        Object.entries(req.query).map(([k, v]) => [
          k,
          Array.isArray(v) ? String(v[0]) : v != null ? String(v) : undefined,
        ]),
      ) as Record<string, string | undefined>;
      const contentType = contentTypeFromRequest(
        req.headers as Record<string, string | string[] | undefined>,
      );
      const rawReq = {
        method: String(req.method ?? "POST"),
        headers: req.headers as Record<string, string | string[] | undefined>,
        rawBody,
        query,
        subPath,
        contentType,
      };
      const secrets = resolveSecrets(connection);
      const ctx = {
        connectionId: connection.id,
        organizationId: connection.organizationId,
        config: JSON.parse(connection.configJson || "{}"),
        secrets,
        webhookUrl: `${req.protocol}://${req.get("host")}${pathOnly}`,
        webhookSecret: secrets.webhookSecret ?? "",
        http: (await import("@era/integrations-kit")).createHttpClient(),
        log: console,
      };
      const challenge = adapter.handleChallenge?.(rawReq, ctx);
      if (challenge) {
        res.status(challenge.status).send(challenge.body);
        return;
      }

      if (
        String(req.method ?? "").toUpperCase() === "POST" &&
        (providerKey === "webchat" || providerKey === "form_generic")
      ) {
        const {
          assertPublicRateLimit,
          verifyMathChallenge,
        } = await import("@/lib/integrations/public-hook-guard");
        const ip =
          String(req.headers["x-forwarded-for"] ?? "")
            .split(",")[0]
            ?.trim() ||
          req.socket.remoteAddress ||
          "unknown";
        const rl = assertPublicRateLimit(`${providerKey}:${publicId}:${ip}`);
        if (!rl.ok) {
          res
            .status(429)
            .setHeader("Retry-After", String(rl.retryAfterSec))
            .json({ error: "Rate limit exceeded", code: "RATE_LIMIT" });
          return;
        }
        let bodyJson: Record<string, unknown> = {};
        try {
          bodyJson = JSON.parse(rawBody.toString("utf8") || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          bodyJson = {};
        }
        const widgetHeader = String(
          req.headers["x-era-widget"] ?? "",
        ).toLowerCase();
        const token = String(
          bodyJson.challengeToken ?? bodyJson.captchaToken ?? "",
        );
        const answer = bodyJson.challengeAnswer ?? bodyJson.captchaAnswer;
        const widgetMode =
          providerKey === "webchat" ||
          widgetHeader === "1" ||
          widgetHeader === "true" ||
          Boolean(token);
        if (widgetMode) {
          if (!verifyMathChallenge(token, answer)) {
            res.status(400).json({
              error: "Captcha required",
              code: "CAPTCHA_REQUIRED",
            });
            return;
          }
        }
      }

      const verify = adapter.verifyWebhook?.(rawReq, ctx) ?? { ok: false, reason: "no verify" };
      if (!verify.ok) {
        res.status(401).json({ error: verify.reason ?? "Unauthorized" });
        return;
      }
      const idem =
        adapter.idempotencyKey?.(rawReq) ??
        (await import("node:crypto")).createHash("sha256").update(rawBody).digest("hex");

      let respondPrefetch:
        | import("@era/integrations-kit").NormalizedEvent[]
        | undefined;
      if (adapter.respond) {
        try {
          respondPrefetch = (await adapter.normalize?.(rawReq, ctx)) ?? [];
        } catch {
          respondPrefetch = [];
        }
      }

      let duplicate = false;
      try {
        await prisma.inboundEvent.create({
          data: {
            organizationId: connection.organizationId,
            connectionId: connection.id,
            idempotencyKey: idem,
            headersJson: JSON.stringify({
              ...req.headers,
              "x-era-subpath": subPath || undefined,
              "x-era-content-type": contentType || undefined,
              ...(respondPrefetch !== undefined
                ? {
                    "x-era-prefetch-events": JSON.stringify(respondPrefetch),
                  }
                : {}),
            }),
            rawBody: rawBody.toString("utf8").slice(0, 500_000),
            status: "RECEIVED",
          },
        });
      } catch {
        duplicate = true;
      }
      if (!duplicate) void enqueueInboundDrain();

      // Always vendor ACK shape on duplicates (Sipuni/VirtualATS/Mango expect success body).
      if (adapter.respond) {
        const ackEvents = respondPrefetch ?? [];
        const custom = adapter.respond(ackEvents, rawReq, ctx);
        if (custom.contentType) res.type(custom.contentType);
        res.status(custom.status).send(custom.body);
        return;
      }
      if (providerKey === "vk_community") {
        res.status(200).send("ok");
        return;
      }
      res.status(200).json({ ok: true, queued: !duplicate, duplicate });
    } catch (err) {
      await sendRouteError(res, err);
    }
  }

  // Public inbound hooks — signature verified by adapter; no session.
  http.all(
    "/api/integrations/hooks/:providerKey/:publicId",
    (req, res) => void handlePublicIntegrationHook(req, res),
  );
  http.all(
    "/api/integrations/hooks/:providerKey/:publicId/*",
    (req, res) => void handlePublicIntegrationHook(req, res),
  );
}
