import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PurchaseRequestsController } from "./purchase-requests.controller";
import { PurchaseRequestsService } from "./purchase-requests.service";
import { SupplierScorecardController } from "./supplier-scorecard.controller";
import { SupplierScorecardService } from "./supplier-scorecard.service";

@Module({
  imports: [PrismaModule],
  controllers: [PurchaseRequestsController, SupplierScorecardController],
  providers: [
    PurchaseRequestsService,
    SupplierScorecardService,
    PermissionsGuard,
  ],
  exports: [PurchaseRequestsService, SupplierScorecardService],
})
export class ProcurementModule {}
