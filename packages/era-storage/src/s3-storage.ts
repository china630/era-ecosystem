import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutObjectLockConfigurationCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { objectLockRetainUntilForKey } from "./storage.constants";
import type { StorageService, StoredObjectMeta } from "./storage.interface";

export type S3StorageConfig = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region?: string;
  publicBaseUrl?: string;
};

export class S3StorageDriver implements StorageService {
  private client!: S3Client;
  private bucket!: string;
  private publicBaseUrl?: string;
  private bucketFeaturesWarned = false;

  constructor(private readonly config: S3StorageConfig) {}

  init() {
    const { endpoint, region = "us-east-1" } = this.config;
    this.bucket = this.config.bucket;
    this.publicBaseUrl = this.config.publicBaseUrl;
    if (!this.bucket || !this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new Error("S3_STORAGE: set bucket, accessKeyId, secretAccessKey");
    }
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
    void this.ensureBucketVersioningAndObjectLock().catch(() => undefined);
  }

  async ensureBucketVersioningAndObjectLock(): Promise<void> {
    const cur = await this.client.send(
      new GetBucketVersioningCommand({ Bucket: this.bucket }),
    );
    if (cur.Status !== "Enabled") {
      await this.client.send(
        new PutBucketVersioningCommand({
          Bucket: this.bucket,
          VersioningConfiguration: { Status: "Enabled" },
        }),
      );
    }
    try {
      const lockCur = await this.client.send(
        new GetObjectLockConfigurationCommand({ Bucket: this.bucket }),
      );
      if (!lockCur.ObjectLockConfiguration?.ObjectLockEnabled) {
        await this.client.send(
          new PutObjectLockConfigurationCommand({
            Bucket: this.bucket,
            ObjectLockConfiguration: {
              ObjectLockEnabled: "Enabled",
              Rule: { DefaultRetention: { Mode: "COMPLIANCE", Years: 1 } },
            },
          }),
        );
      }
    } catch {
      // bucket may not support object lock
    }
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options?: { contentType?: string },
  ): Promise<StoredObjectMeta> {
    const bodyForSdk =
      typeof (body as Readable).pipe === "function"
        ? await streamToBuffer(body as Readable)
        : Buffer.isBuffer(body)
          ? body
          : Buffer.from(body as Uint8Array);

    const retainUntil = objectLockRetainUntilForKey(key);
    const putBase = {
      Bucket: this.bucket,
      Key: key,
      Body: bodyForSdk,
      ContentType: options?.contentType,
    } as const;

    if (retainUntil) {
      try {
        await this.client.send(
          new PutObjectCommand({
            ...putBase,
            ObjectLockMode: "COMPLIANCE",
            ObjectLockRetainUntilDate: retainUntil,
          }),
        );
      } catch {
        if (!this.bucketFeaturesWarned) this.bucketFeaturesWarned = true;
        await this.client.send(new PutObjectCommand({ ...putBase }));
      }
    } else {
      await this.client.send(new PutObjectCommand({ ...putBase }));
    }
    return { key, contentType: options?.contentType, size: bodyForSdk.length };
  }

  async getObject(key: string): Promise<Buffer> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) throw new Error(`S3: empty body for ${key}`);
    return streamToBuffer(out.Body as Readable);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    return `s3://${this.bucket}/${key}`;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
