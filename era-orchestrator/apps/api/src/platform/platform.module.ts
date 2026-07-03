import { Module } from "@nestjs/common";
import { BookingModule } from "./booking/booking.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { DomainsModule } from "./domains/domains.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PaymentsModule } from "./payments/payments.module";
import { PortalModule } from "./portal/portal.module";
import { ReferenceDataModule } from "./reference-data/reference-data.module";
import { CatalogGatewayModule } from "./catalog/catalog-gateway.module";
import { WorkforcePolicyModule } from "./workforce/workforce-policy.module";
import { WorkforceHubModule } from "./workforce/workforce-hub.module";

@Module({
  imports: [
    BookingModule,
    PortalModule,
    PaymentsModule,
    LoyaltyModule,
    DomainsModule,
    DeliveryModule,
    NotificationsModule,
    ReferenceDataModule,
    CatalogGatewayModule,
    WorkforcePolicyModule,
    WorkforceHubModule,
  ],
})
export class PlatformModule {}
