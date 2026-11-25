import { Global, Module } from "@nestjs/common";
import { BankOrgConfig } from "./bank-org.config";
import { InstitutionConfigService } from "./institution-config.service";

@Global()
@Module({
  providers: [BankOrgConfig, InstitutionConfigService],
  exports: [BankOrgConfig, InstitutionConfigService],
})
export class BankCommonModule {}
