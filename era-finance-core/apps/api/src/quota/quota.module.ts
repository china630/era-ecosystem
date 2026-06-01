import { Global, Module, forwardRef } from "@nestjs/common";
import { QuotaGuard } from "../common/guards/quota.guard";
import { BillingModule } from "../billing/billing.module";
import { ControlPlaneModule } from "../control-plane/control-plane.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SystemConfigModule } from "../system-config/system-config.module";
import { QuotaService } from "./quota.service";

@Global()
@Module({
  imports: [
    PrismaModule,
    SystemConfigModule,
    ControlPlaneModule,
    forwardRef(() => BillingModule),
  ],
  providers: [QuotaService, QuotaGuard],
  exports: [QuotaService, QuotaGuard],
})
export class QuotaModule {}
