import { Module } from "@nestjs/common";
import { LoansModule } from "../loans/loans.module";
import { MfiController } from "./mfi.controller";
import { MfiService } from "./mfi.service";

@Module({
  imports: [LoansModule],
  controllers: [MfiController],
  providers: [MfiService],
  exports: [MfiService],
})
export class MfiModule {}