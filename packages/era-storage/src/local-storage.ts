import { createWriteStream, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { StorageService, StoredObjectMeta } from "./storage.interface";

export class LocalStorageDriver implements StorageService {
  private readonly root: string;

  constructor(root?: string) {
    this.root = root ?? join(process.cwd(), "storage", "uploads");
  }

  init() {
    // no-op; path logged by host app if needed
  }

  private resolvePath(key: string): string {
    const safe = key.replace(/\\/g, "/").replace(/^\/+/, "");
    if (safe.includes("..")) throw new Error("Invalid storage key");
    return join(this.root, safe);
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options?: { contentType?: string },
  ): Promise<StoredObjectMeta> {
    const path = this.resolvePath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      await fs.writeFile(path, body);
      return { key, contentType: options?.contentType, size: body.length };
    }
    await pipeline(body, createWriteStream(path));
    const stat = await fs.stat(path);
    return { key, contentType: options?.contentType, size: stat.size };
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async deleteObject(key: string): Promise<void> {
    await fs.unlink(this.resolvePath(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err;
    });
  }

  getPublicUrl(key: string): string {
    return `/files/${key.replace(/\\/g, "/")}`;
  }
}
