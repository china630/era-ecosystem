import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../platform/notifications/notifications.module";
import { CommsController } from "./comms.controller";
import { CommsService } from "./comms.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
