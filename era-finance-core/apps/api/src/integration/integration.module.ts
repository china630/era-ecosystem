import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";
import { SatelliteEventIdempotencyService } from "./satellite-event-idempotency.service";
import { SatelliteEventWorker } from "./satellite-event.worker";

@Module({
  imports: [PrismaModule, AccountingModule, InvoicesModule],
  providers: [
    SatelliteEventIdempotencyService,
    SatelliteEventDispatchService,
    SatelliteEventWorker,
  ],
})
export class SatelliteIntegrationModule {}
