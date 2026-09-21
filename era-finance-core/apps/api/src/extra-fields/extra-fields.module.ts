import { Module } from "@nestjs/common";
import { ExtraFieldsController } from "./extra-fields.controller";
import { ExtraFieldsService } from "./extra-fields.service";

@Module({
  controllers: [ExtraFieldsController],
  providers: [ExtraFieldsService],
  exports: [ExtraFieldsService],
})
export class ExtraFieldsModule {}
