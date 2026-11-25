import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import { SatelliteMutationAuditInterceptor } from "@era/satellite-kit/nest";
import { prisma } from "@/lib/prisma";
import { HotelNativeModule } from "./native/hotel-native.module";
import { KitApiController } from "./kit-api.controller";

void KitApiController;

@Module({
  imports: [HotelNativeModule],
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
