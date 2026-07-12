import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HoldingsController } from "./holdings.controller";
import { HoldingsService } from "./holdings.service";
import { InternalHoldingsController } from "./internal-holdings.controller";

@Module({
  imports: [PrismaModule],
  controllers: [HoldingsController, InternalHoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {}
