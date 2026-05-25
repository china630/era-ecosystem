import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { PrismaModule } from "../prisma/prisma.module";
import {
  DisputeAdminController,
  DisputePublicController,
} from "./dispute.controller";
import { DisputeService } from "./dispute.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DisputeAdminController, DisputePublicController],
  providers: [DisputeService, JwtAuthGuard, SuperAdminGuard],
  exports: [DisputeService],
})
export class DisputeModule {}
