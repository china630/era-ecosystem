import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { AdminAuditLogsController } from "./admin-audit-logs.controller";
import { AdminController } from "./admin.controller";
import { AdminCatalogService } from "./admin-catalog.service";
import { AdminService } from "./admin.service";
import { AdminAuditLogsService } from "./audit.service";
import { PricingService } from "./pricing.service";
import { PublicTranslationsController } from "./public-translations.controller";

@Module({
  imports: [PrismaModule, SystemConfigModule, forwardRef(() => AuthModule)],
  controllers: [
    AdminController,
    AdminAuditLogsController,
    PublicTranslationsController,
  ],
  providers: [AdminService, AdminCatalogService, AdminAuditLogsService, PricingService],
  exports: [AdminService, PricingService],
})
export class AdminModule {}
