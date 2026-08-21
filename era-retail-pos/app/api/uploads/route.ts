import { satelliteOrganizationId } from "@era/satellite-kit";
import { createStorageService } from "@era/storage";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.PLATFORM_STORAGE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "platform_storage add-on required" },
      { status: 403 },
    );
  }
  const orgId = satelliteOrganizationId();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const key = `attachments/${orgId}/${randomUUID()}.${ext}`;
  const storage = createStorageService({
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_LOCAL_ROOT: process.env.STORAGE_LOCAL_ROOT,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  });
  await storage.putObject(key, buffer, { contentType: file.type || undefined });
  return NextResponse.json({ key, publicUrl: storage.getPublicUrl?.(key) });
}
