import { Global, Module } from "@nestjs/common";
import { RegistryCacheService } from "./registry-cache.service";
import { RegistryCacheHeadersInterceptor } from "./registry-cache-headers.interceptor";

@Global()
@Module({
  providers: [RegistryCacheService, RegistryCacheHeadersInterceptor],
  exports: [RegistryCacheService, RegistryCacheHeadersInterceptor],
})
export class CacheModule {}
