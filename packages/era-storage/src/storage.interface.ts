import type { Readable } from "node:stream";

export type StoredObjectMeta = {
  key: string;
  contentType?: string;
  size?: number;
};

export interface StorageService {
  putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options?: { contentType?: string },
  ): Promise<StoredObjectMeta>;

  getObject(key: string): Promise<Buffer>;

  deleteObject(key: string): Promise<void>;

  getPublicUrl?(key: string): string;
}

export type ObjectStoragePort = StorageService;

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

export type StorageEnvConfig = {
  STORAGE_DRIVER?: string;
  STORAGE_LOCAL_ROOT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_PUBLIC_BASE_URL?: string;
};
