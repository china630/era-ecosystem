import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ActivityStreamModule } from "../activity-stream/activity-stream.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DataMaskingService } from "../privacy/data-masking.service";
import { AuditService } from "./audit.service";

/** Billing payment audit only — no ERP audit controller/interceptor on CP. */
@Module({
  imports: [PrismaModule, ConfigModule, ActivityStreamModule],
  providers: [DataMaskingService, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
