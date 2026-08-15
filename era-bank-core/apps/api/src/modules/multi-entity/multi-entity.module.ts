import { Module } from "@nestjs/common";
import { MultiEntityController } from "./multi-entity.controller";
import { MultiEntityService } from "./multi-entity.service";

@Module({
  controllers: [MultiEntityController],
  providers: [MultiEntityService],
  exports: [MultiEntityService],
})
export class MultiEntityModule {}
