import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { ServiceTokenGuard } from "./service-token.guard";
import { RegistryAuthGuard } from "./registry-auth.guard";

@Module({
  providers: [ApiKeyGuard, ServiceTokenGuard, RegistryAuthGuard],
  exports: [ApiKeyGuard, ServiceTokenGuard, RegistryAuthGuard],
})
export class AuthModule {}
