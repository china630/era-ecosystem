import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  AdminChannelsBatchController,
  AdminChannelsController,
} from "./admin-channels.controller";
import { InternalChannelsController } from "./internal-channels.controller";
import { PlatformChannelsController } from "./platform-channels.controller";
import { SatelliteChannelsService } from "./satellite-channels.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminChannelsController,
    AdminChannelsBatchController,
    PlatformChannelsController,
    InternalChannelsController,
  ],
  providers: [SatelliteChannelsService],
  exports: [SatelliteChannelsService],
})
export class ChannelsModule {}
