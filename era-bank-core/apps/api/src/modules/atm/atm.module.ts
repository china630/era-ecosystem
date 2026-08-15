import { Module } from "@nestjs/common";
import { AtmController } from "./atm.controller";
import { AtmService } from "./atm.service";
import { SchemeSwitchAdapter } from "./scheme.adapter";

@Module({
  controllers: [AtmController],
  providers: [AtmService, SchemeSwitchAdapter],
  exports: [AtmService],
})
export class AtmModule {}
