import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import express from "express";
import { SatelliteMutationAuditInterceptor } from "@era/satellite-kit/nest";
import { onSatelliteBoot } from "@era/satellite-kit/tenancy/boot";
import { prisma } from "@/lib/prisma";
// Nest serves /api via ClinicNativeModule instead of createSatelliteApiController.
import { ClinicNativeModule } from "./native/clinic-native.module";
import { GuestCareController } from "./guest-care-routes";
import { ClinicKitController } from "./kit-routes";
import { AuditExemptController, loadClinicAuditExemptCache } from "./audit-exempt.controller";

@Module({
  imports: [ClinicNativeModule],
  controllers: [GuestCareController, ClinicKitController, AuditExemptController],
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
  try {
    const bound = await onSatelliteBoot({ prisma, satelliteKey: "industry_clinic" });
    if (bound.organizationId) {
      console.info(
        `[clinic] nest organization bind hydrated source=${bound.source} org=${bound.organizationId}`,
      );
    }
  } catch (err) {
    console.error("[clinic] nest onSatelliteBoot failed", err);
  }
  try {
    await loadClinicAuditExemptCache();
  } catch (err) {
    console.error("[clinic] audit-exempt cache skipped", err);
  }
  const port = Number(process.env.NEST_PORT ?? process.env.CLINIC_NEST_PORT ?? 13203);
  await app.listen(port, "127.0.0.1");
  console.log(`clinic nest http://127.0.0.1:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
