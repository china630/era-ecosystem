import { Module } from "@nestjs/common";
import { WealthController } from "./wealth.controller";
import { WealthService } from "./wealth.service";

@Module({
  controllers: [WealthController],
  providers: [WealthService],
  exports: [WealthService],
})
export class WealthModule {}
