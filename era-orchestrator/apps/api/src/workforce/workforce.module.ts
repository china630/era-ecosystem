import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkforceRegistryController } from "./workforce-registry.controller";
import { WorkforceRegistryService } from "./workforce-registry.service";

@Module({
  imports: [PrismaModule],
  controllers: [WorkforceRegistryController],
  providers: [WorkforceRegistryService],
  exports: [WorkforceRegistryService],
})
export class WorkforceModule {}
