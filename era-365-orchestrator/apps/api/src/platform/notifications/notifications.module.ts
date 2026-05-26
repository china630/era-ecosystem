import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { QuotaModule } from "../../quota/quota.module";
import { PlatformSharedModule } from "../platform-shared.module";
import { EmailAdapter } from "./adapters/email.adapter";
import { SmsAdapter } from "./adapters/sms.adapter";
import { WhatsappAdapter } from "./adapters/whatsapp.adapter";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsDispatchService } from "./notifications-dispatch.service";
import { NotificationsOutboxWorker } from "./notifications-outbox.worker";
import { NotificationsWebhookController } from "./notifications-webhook.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PrismaModule, QuotaModule, PlatformSharedModule],
  controllers: [
    NotificationsController,
    AdminNotificationsController,
    NotificationsWebhookController,
  ],
  providers: [
    NotificationsService,
    NotificationsDispatchService,
    NotificationsOutboxWorker,
    EmailAdapter,
    WhatsappAdapter,
    SmsAdapter,
  ],
  exports: [NotificationsService, NotificationsDispatchService],
})
export class NotificationsModule {}
