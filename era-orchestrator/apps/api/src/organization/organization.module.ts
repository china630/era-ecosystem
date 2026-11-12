import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { InternalOrganizationsController } from "./internal-organizations.controller";
import { OrganizationController } from "./organization.controller";
import { GuestAppController, GuestAppPublicController } from "./guest-app.controller";
import { GuestAppService } from "./guest-app.service";
import { OrganizationProfileController } from "./organization-profile.controller";
import { OrganizationProfileService } from "./organization-profile.service";
import { OrganizationService } from "./organization.service";
import { OrgAccessCredentialService } from "../admin/org-access-credential.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    OrganizationController,
    OrganizationProfileController,
    GuestAppController,
    GuestAppPublicController,
    InternalOrganizationsController,
  ],
  providers: [
    OrganizationService,
    OrganizationProfileService,
    GuestAppService,
    OrgAccessCredentialService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [OrganizationService, OrganizationProfileService],
})
export class OrganizationModule {}
