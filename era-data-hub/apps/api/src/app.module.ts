import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CacheModule } from "./cache/cache.module";
import { RegistryCacheHeadersInterceptor } from "./cache/registry-cache-headers.interceptor";
import { IngestModule } from "./ingest/ingest.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RegistryModule } from "./registry/registry.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    CacheModule,
    AuthModule,
    RegistryModule,
    IngestModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RegistryCacheHeadersInterceptor,
    },
  ],
})
export class AppModule {}
