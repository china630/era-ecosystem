import { Global, Module } from "@nestjs/common";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [ControlPlanePrismaService, PrismaService],
  exports: [ControlPlanePrismaService, PrismaService],
})
export class PrismaModule {}
