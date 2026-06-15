import { Global, Module } from "@nestjs/common";
import { BankOrgConfig } from "./bank-org.config";

@Global()
@Module({
  providers: [BankOrgConfig],
  exports: [BankOrgConfig],
})
export class BankCommonModule {}
