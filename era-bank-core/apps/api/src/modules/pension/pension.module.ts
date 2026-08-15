import { Module } from "@nestjs/common";
import { PensionController } from "./pension.controller";
import { PensionService } from "./pension.service";

@Module({
  controllers: [PensionController],
  providers: [PensionService],
  exports: [PensionService],
})
export class PensionModule {}
