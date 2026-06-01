import { createStorageService, type StorageService } from "@era/storage";
import { randomUUID } from "crypto";

let storageSingleton: StorageService | null = null;

export function getSatelliteStorage(): StorageService {
  if (!storageSingleton) {
    storageSingleton = createStorageService({
      STORAGE_DRIVER: process.env.STORAGE_DRIVER,
      STORAGE_LOCAL_ROOT: process.env.STORAGE_LOCAL_ROOT,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_REGION: process.env.S3_REGION,
      S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
    });
  }
  return storageSingleton;
}

/** Upload buffer to tenant-scoped key under attachments/ prefix. */
export async function uploadSatelliteAttachment(input: {
  organizationId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ key: string; publicUrl?: string }> {
  const ext = input.fileName.split(".").pop()?.toLowerCase() || "bin";
  const key = `attachments/${input.organizationId}/${randomUUID()}.${ext}`;
  const storage = getSatelliteStorage();
  await storage.putObject(key, input.buffer, { contentType: input.contentType });
  return { key, publicUrl: storage.getPublicUrl?.(key) };
}
