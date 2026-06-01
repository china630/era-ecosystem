import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createStorageService } from "@era/storage";
import { STORAGE_SERVICE, type StorageService } from "./storage.interface";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService =>
        createStorageService({
          STORAGE_DRIVER: config.get<string>("STORAGE_DRIVER"),
          STORAGE_LOCAL_ROOT: config.get<string>("STORAGE_LOCAL_ROOT"),
          S3_BUCKET: config.get<string>("S3_BUCKET"),
          S3_ACCESS_KEY_ID: config.get<string>("S3_ACCESS_KEY_ID"),
          S3_SECRET_ACCESS_KEY: config.get<string>("S3_SECRET_ACCESS_KEY"),
          S3_ENDPOINT: config.get<string>("S3_ENDPOINT"),
          S3_REGION: config.get<string>("S3_REGION"),
          S3_PUBLIC_BASE_URL: config.get<string>("S3_PUBLIC_BASE_URL"),
        }),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
