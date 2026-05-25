import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { QuotaModule } from "../../quota/quota.module";
import { EmailAdapter } from "./adapters/email.adapter";
import { SmsAdapter } from "./adapters/sms.adapter";
import { WhatsappAdapter } from "./adapters/whatsapp.adapter";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PrismaModule, QuotaModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    EmailAdapter,
    WhatsappAdapter,
    SmsAdapter,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
