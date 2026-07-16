import { Module } from "@nestjs/common";
import { CifModule } from "../cif/cif.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";
import { SystemGlConfigService } from "./system-gl-config.service";

@Module({
  imports: [CifModule],
  controllers: [LedgerController],
  providers: [LedgerService, SystemGlConfigService],
  exports: [LedgerService, SystemGlConfigService],
})
export class LedgerModule {}
