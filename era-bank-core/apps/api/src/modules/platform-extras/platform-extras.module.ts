import { Module } from "@nestjs/common";
import { PlatformExtrasController } from "./platform-extras.controller";
import { PlatformExtrasService } from "./platform-extras.service";

@Module({
  controllers: [PlatformExtrasController],
  providers: [PlatformExtrasService],
  exports: [PlatformExtrasService],
})
export class PlatformExtrasModule {}
