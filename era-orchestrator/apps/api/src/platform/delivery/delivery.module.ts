import { Module } from "@nestjs/common";
import { PlatformSharedModule } from "../platform-shared.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  imports: [PrismaModule, PlatformSharedModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}

