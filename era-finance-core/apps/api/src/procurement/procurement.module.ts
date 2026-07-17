import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ProcurementProtocolsController } from "./procurement-protocols.controller";
import { ProcurementProtocolsService } from "./procurement-protocols.service";
import { PurchaseRequestsController } from "./purchase-requests.controller";
import { PurchaseRequestsService } from "./purchase-requests.service";
import { SupplierScorecardController } from "./supplier-scorecard.controller";
import { SupplierScorecardService } from "./supplier-scorecard.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    PurchaseRequestsController,
    SupplierScorecardController,
    ProcurementProtocolsController,
  ],
  providers: [
    PurchaseRequestsService,
    SupplierScorecardService,
    ProcurementProtocolsService,
    PermissionsGuard,
  ],
  exports: [
    PurchaseRequestsService,
    SupplierScorecardService,
    ProcurementProtocolsService,
  ],
})
export class ProcurementModule {}
