import { Module } from "@nestjs/common";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
