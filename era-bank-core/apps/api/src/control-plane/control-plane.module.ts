import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationBindController } from "./organization-bind.controller";
import { RuntimeConfigController } from "./runtime-config.controller";

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationBindController, RuntimeConfigController],
})
export class ControlPlaneModule {}
