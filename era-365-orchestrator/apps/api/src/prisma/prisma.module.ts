import { Global, Module } from "@nestjs/common";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";

@Global()
@Module({
  providers: [ControlPlanePrismaService],
  exports: [ControlPlanePrismaService],
})
export class PrismaModule {}
