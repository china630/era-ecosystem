import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
} from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { registerDboRoutes } from "./generated/register";
import { registerKitRoutes } from "./kit-routes";

const router = express.Router();
registerDboRoutes(router);
registerKitRoutes(router);
const DboApiController = createSatelliteApiController(router);

@Module({
  controllers: [DboApiController],
})
class DboNestModule {}

async function main() {
  const app = await NestFactory.create(DboNestModule, { logger: ["error", "warn"] });
  app.useGlobalInterceptors(
    new SatelliteMutationAuditInterceptor(async (row) => {
      await prisma.satelliteAuditLog.create({ data: row });
    }),
  );
  const http = app.getHttpAdapter().getInstance();
  http.use(express.json({ limit: "2mb" }));
  const publicApi = ["/api/health", "/api/auth"];
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
  const port = Number(process.env.NEST_PORT ?? process.env.DBO_NEST_PORT ?? 13211);
  await app.listen(port, "127.0.0.1");
  console.log(`dbo nest http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
