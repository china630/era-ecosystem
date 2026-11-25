import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUGS = new Set(["nurse", "guest", "hotel-staff"]);

function rootDir(): string {
  const fromEnv = process.env.TABLET_APPS_DIR?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [
    path.join(process.cwd(), "tablet-apps"),
    path.join(process.cwd(), "apps/web/tablet-apps"),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; file: string }> },
): Promise<NextResponse> {
  const { slug, file } = await ctx.params;
  if (!SLUGS.has(slug)) {
    return NextResponse.json({ error: "Unknown app" }, { status: 404 });
  }
  if (file !== "version.json" && !/^[\w.-]+\.apk$/.test(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dir = path.join(rootDir(), slug);
  const full = path.join(dir, file);
  if (path.resolve(full) !== path.join(path.resolve(dir), file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const info = await stat(full);
    if (!info.isFile()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const type = file.endsWith(".apk")
    ? "application/vnd.android.package-archive"
    : "application/json; charset=utf-8";
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}
