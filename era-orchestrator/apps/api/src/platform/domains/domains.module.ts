import { Module } from "@nestjs/common";
import { PlatformSharedModule } from "../platform-shared.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [PrismaModule, PlatformSharedModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}

