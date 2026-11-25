import { Module } from "@nestjs/common";
import { MisController } from "./mis.controller";
import { MisService } from "./mis.service";

@Module({
  controllers: [MisController],
  providers: [MisService],
  exports: [MisService],
})
export class MisModule {}