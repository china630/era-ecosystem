import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
} from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { registerClinicRoutes } from "./generated/register";
import { registerGuestCareRoutes } from "./guest-care-routes";
import { registerKitRoutes } from "./kit-routes";

const router = express.Router();
registerClinicRoutes(router);
registerGuestCareRoutes(router);
registerKitRoutes(router);
const ClinicApiController = createSatelliteApiController(router);

@Module({
  controllers: [ClinicApiController],
})
class ClinicNestModule {}

async function main() {
  const app = await NestFactory.create(ClinicNestModule, {
    logger: ["error", "warn"],
    bodyParser: false,
  });
  app.useGlobalInterceptors(
    new SatelliteMutationAuditInterceptor(async (row) => {
      await prisma.satelliteAuditLog.create({ data: row });
    }, ["/api/auth/session/refresh-permissions"]),
  );
  const http = app.getHttpAdapter().getInstance();
  http.use(express.json({ limit: "8mb" }));
  http.use(express.urlencoded({ extended: true, limit: "2mb" }));
  const port = Number(process.env.NEST_PORT ?? process.env.CLINIC_NEST_PORT ?? 13203);
  await app.listen(port, "127.0.0.1");
  console.log(`clinic nest http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
