import { Module } from "@nestjs/common";
import { BookingModule } from "./booking/booking.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { DomainsModule } from "./domains/domains.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PaymentsModule } from "./payments/payments.module";
import { PortalModule } from "./portal/portal.module";

@Module({
  imports: [
    BookingModule,
    PortalModule,
    PaymentsModule,
    LoyaltyModule,
    DomainsModule,
    DeliveryModule,
    NotificationsModule,
  ],
})
export class PlatformModule {}
