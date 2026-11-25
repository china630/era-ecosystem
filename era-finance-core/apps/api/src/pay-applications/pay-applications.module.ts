import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PayApplicationsController } from "./pay-applications.controller";
import { PayApplicationsService } from "./pay-applications.service";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [PayApplicationsController],
  providers: [PayApplicationsService],
  exports: [PayApplicationsService],
})
export class PayApplicationsModule {}
