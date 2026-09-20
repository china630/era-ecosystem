import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { CpAccessController } from "./cp-access.controller";
import { CpAccessService } from "./cp-access.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CpAccessController],
  providers: [CpAccessService, PermissionsGuard],
  exports: [CpAccessService],
})
export class AccessModule {}
