import { Module } from "@nestjs/common";
import { MdmController } from "./mdm.controller";
import { AdminMdmController } from "./admin-mdm.controller";
import { MdmConsentPortalController } from "./mdm-consent-portal.controller";
import { MdmService } from "./mdm.service";
import { MdmPrismaService } from "../prisma/mdm-prisma.service";

@Module({
  controllers: [MdmController, AdminMdmController, MdmConsentPortalController],
  providers: [MdmService, MdmPrismaService],
  exports: [MdmService],
})
export class MdmModule {}
