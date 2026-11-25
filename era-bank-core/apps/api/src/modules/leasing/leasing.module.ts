import { Module } from "@nestjs/common";
import { LoansModule } from "../loans/loans.module";
import { LeasingController } from "./leasing.controller";
import { LeasingService } from "./leasing.service";

@Module({
  imports: [LoansModule],
  controllers: [LeasingController],
  providers: [LeasingService],
  exports: [LeasingService],
})
export class LeasingModule {}