import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
} from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { registerCrmRoutes } from "./generated/register";
import { registerKitRoutes } from "./kit-routes";
import { registerIntegrationsRoutes } from "./integrations-routes";
import { startOutboxWorkerLoop } from "@/lib/integrations/outbox.worker";
import { startInboundWorkerLoop } from "@/lib/integrations/inbound.worker";
import { startEmailPollerLoop } from "@/lib/integrations/email.poller";
import { startOauthRenewLoop } from "@/lib/integrations/oauth-renew.worker";

const router = express.Router();
registerCrmRoutes(router);
registerKitRoutes(router);
registerIntegrationsRoutes(router);
const CrmApiController = createSatelliteApiController(router);

@Module({
  controllers: [CrmApiController],
})
class CrmNestModule {}

async function main() {
  const app = await NestFactory.create(CrmNestModule, { logger: ["error", "warn"] });
  app.useGlobalInterceptors(
    new SatelliteMutationAuditInterceptor(async (row) => {
      await prisma.satelliteAuditLog.create({ data: row });
    }),
  );
  const http = app.getHttpAdapter().getInstance();

  // TZ T-I05: capture raw body for HMAC *before* any JSON parser consumes the stream.
  http.use(
    "/api/integrations/hooks",
    express.json({
      limit: "5mb",
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  http.use(express.json({ limit: "2mb" }));

  const publicApi = [
    "/api/auth/login",
    "/api/auth/sso/exchange",
    "/api/auth/agency-sso/exchange",
    "/api/health",
    "/api/events/dispatch",
    "/api/locale",
    "/api/internal",
    "/api/integration/staff-provision",
    "/api/integrations/hooks",
    "/api/integrations/ics",
  ];
  http.use(
    (
      req: { originalUrl?: string; url?: string; headers: Record<string, unknown> },
      res: { status: (code: number) => { json: (body: unknown) => void } },
      next: () => void,
    ) => {
      const pathname = String(req.originalUrl ?? req.url ?? "").split("?")[0];
      if (!pathname.startsWith("/api")) return next();
      if (publicApi.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        return next();
      }
      const cookie = String(req.headers.cookie ?? "");
      const bearer = String(req.headers.authorization ?? "");
      if (!cookie && !bearer.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    },
  );
  const port = Number(process.env.NEST_PORT ?? process.env.CRM_NEST_PORT ?? 13207);
  await app.listen(port, "127.0.0.1");
  console.log(`crm nest http://127.0.0.1:${port}`);
  // TZ T-I05 / T-I06 / T-I13 / T-I24 / T-I28: workers + OAuth renew + calendar sync.
  startInboundWorkerLoop();
  startOutboxWorkerLoop();
  startEmailPollerLoop();
  startOauthRenewLoop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
