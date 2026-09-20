import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { InternalOrganizationsController } from "./internal-organizations.controller";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationController, InternalOrganizationsController],
  providers: [OrganizationService, JwtAuthGuard, PermissionsGuard],
  exports: [OrganizationService],
})
export class OrganizationModule {}
