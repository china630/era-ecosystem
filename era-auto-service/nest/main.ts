import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
} from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { registerAutoRoutes } from "./generated/register";
import { registerKitRoutes } from "./kit-routes";

const router = express.Router();
registerAutoRoutes(router);
registerKitRoutes(router);
const AutoApiController = createSatelliteApiController(router);

@Module({
  controllers: [AutoApiController],
})
class AutoNestModule {}

async function main() {
  const app = await NestFactory.create(AutoNestModule, { logger: ["error", "warn"] });
  app.useGlobalInterceptors(
    new SatelliteMutationAuditInterceptor(async (row) => {
      await prisma.satelliteAuditLog.create({ data: row });
    }),
  );
  const http = app.getHttpAdapter().getInstance();
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
  ];
  http.use((req: { originalUrl?: string; url?: string; headers: Record<string, unknown> }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const pathname = String(req.originalUrl ?? req.url ?? "").split("?")[0];
    if (!pathname.startsWith("/api")) return next();
    if (publicApi.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return next();
    const cookie = String(req.headers.cookie ?? "");
    const bearer = String(req.headers.authorization ?? "");
    if (!cookie && !bearer.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
  const port = Number(process.env.NEST_PORT ?? process.env.AUTO_NEST_PORT ?? 13208);
  await app.listen(port, "127.0.0.1");
  console.log(`auto nest http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
