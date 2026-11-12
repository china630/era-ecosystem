import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
} from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { registerGuestRoutes } from "./generated/register";
import { registerGuestAppRoutes } from "./guest-app-routes";
import { registerKitRoutes } from "./kit-routes";
import { registerStayMobilityRoutes } from "./stay-mobility-routes";

const router = express.Router();
registerGuestRoutes(router);
registerGuestAppRoutes(router);
registerKitRoutes(router);
registerStayMobilityRoutes(router);
const HotelApiController = createSatelliteApiController(router);

@Module({
  controllers: [HotelApiController],
})
class HotelGuestNestModule {}

async function main() {
  const app = await NestFactory.create(HotelGuestNestModule, { logger: ["error", "warn"] });
  app.useGlobalInterceptors(
    new SatelliteMutationAuditInterceptor(async (row) => {
      await prisma.satelliteAuditLog.create({ data: row });
    }, ["/api/auth/session/refresh-permissions"]),
  );
  const http = app.getHttpAdapter().getInstance();
  http.use(express.json());
  const port = Number(process.env.NEST_PORT ?? process.env.HOTEL_NEST_PORT ?? 13201);
  await app.listen(port, "127.0.0.1");
  console.log(`hotel guest nest http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
