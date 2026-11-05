import { Module } from "@nestjs/common";
import { AccessControlModule } from "../access/access-control.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StructureController } from "./structure.controller";
import { StructureInternalController } from "./structure-internal.controller";
import { StructureService } from "./structure.service";

@Module({
  imports: [PrismaModule, AccessControlModule],
  controllers: [StructureController, StructureInternalController],
  providers: [StructureService],
  exports: [StructureService],
})
export class StructureModule {}
