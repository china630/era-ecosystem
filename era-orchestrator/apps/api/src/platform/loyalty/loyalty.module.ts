import { Module } from "@nestjs/common";
import { PlatformSharedModule } from "../platform-shared.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyService } from "./loyalty.service";

@Module({
  imports: [PrismaModule, PlatformSharedModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}

