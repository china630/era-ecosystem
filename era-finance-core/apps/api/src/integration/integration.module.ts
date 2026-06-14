import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { HrModule } from "../hr/hr.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FinanceAccountingAdapterService } from "./accounting-adapter.service";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";
import { SatelliteEventIdempotencyService } from "./satellite-event-idempotency.service";
import { SatelliteEventWorker } from "./satellite-event.worker";

@Module({
  imports: [PrismaModule, AccountingModule, InvoicesModule, HrModule],
  providers: [
    SatelliteEventIdempotencyService,
    SatelliteEventDispatchService,
    FinanceAccountingAdapterService,
    SatelliteEventWorker,
  ],
  exports: [FinanceAccountingAdapterService, SatelliteEventDispatchService],
})
export class SatelliteIntegrationModule {}
