import { Module } from "@nestjs/common";
import { PlatformSharedModule } from "../platform-shared.module";
import { ReferenceDataController } from "./reference-data.controller";
import { ReferenceDataService } from "./reference-data.service";

@Module({
  imports: [PlatformSharedModule],
  controllers: [ReferenceDataController],
  providers: [ReferenceDataService],
})
export class ReferenceDataModule {}
