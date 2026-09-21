import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ChannexVendorService } from "./channex-vendor.service";
import { ChannexVendorAdminController } from "./channex-vendor-admin.controller";
import { ChannexVendorInternalController } from "./channex-vendor-internal.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ChannexVendorAdminController, ChannexVendorInternalController],
  providers: [ChannexVendorService],
  exports: [ChannexVendorService],
})
export class VendorsModule {}
