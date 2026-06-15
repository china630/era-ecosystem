import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { BranchModule } from "./branch/branch.module";
import { CifModule } from "./cif/cif.module";
import { EodModule } from "./eod/eod.module";
import { LedgerModule } from "./ledger/ledger.module";
import { PostingEngineModule } from "./posting-engine/posting-engine.module";
import { ProductFactoryModule } from "./product-factory/product-factory.module";

@Module({
  imports: [
    AuditModule,
    PostingEngineModule,
    CifModule,
    LedgerModule,
    BranchModule,
    EodModule,
    ProductFactoryModule,
  ],
  exports: [
    PostingEngineModule,
    CifModule,
    LedgerModule,
    BranchModule,
    EodModule,
    ProductFactoryModule,
    AuditModule,
  ],
})
export class KernelModule {}
