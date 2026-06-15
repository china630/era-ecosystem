import { Global, Module } from "@nestjs/common";
import { BankAuthGuard, JwtAuthGuard, ServiceTokenGuard } from "./bank-auth.guard";
import { BankingModuleGuard } from "./banking-module.guard";

@Global()
@Module({
  providers: [ServiceTokenGuard, JwtAuthGuard, BankAuthGuard, BankingModuleGuard],
  exports: [ServiceTokenGuard, JwtAuthGuard, BankAuthGuard, BankingModuleGuard],
})
export class AuthModule {}
