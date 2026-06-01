import { LocalStorageDriver } from "./local-storage";
import { S3StorageDriver } from "./s3-storage";
import type { StorageEnvConfig, StorageService } from "./storage.interface";

export function createStorageService(config: StorageEnvConfig): StorageService {
  const driver = (config.STORAGE_DRIVER ?? "s3").toLowerCase();
  if (driver === "local") {
    const local = new LocalStorageDriver(config.STORAGE_LOCAL_ROOT);
    local.init();
    return local;
  }
  const s3 = new S3StorageDriver({
    bucket: config.S3_BUCKET ?? "",
    accessKeyId: config.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? "",
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    publicBaseUrl: config.S3_PUBLIC_BASE_URL,
  });
  s3.init();
  return s3;
}

export * from "./storage.interface";
export * from "./storage.constants";
export { LocalStorageDriver } from "./local-storage";
export { S3StorageDriver } from "./s3-storage";
