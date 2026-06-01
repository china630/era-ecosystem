import { Module } from "@nestjs/common";
import { BillingModule } from "../../billing/billing.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PlatformSharedModule } from "../platform-shared.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [PrismaModule, PlatformSharedModule, BillingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
