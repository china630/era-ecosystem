import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AccessControlService } from "./access-control.service";
import { BillingAccessGuard } from "./billing-access.guard";
import { DisputeFreezeGuard } from "./dispute-freeze.guard";

@Module({
  imports: [PrismaModule],
  providers: [AccessControlService, BillingAccessGuard, DisputeFreezeGuard],
  exports: [AccessControlService, BillingAccessGuard, DisputeFreezeGuard],
})
export class AccessControlModule {}
