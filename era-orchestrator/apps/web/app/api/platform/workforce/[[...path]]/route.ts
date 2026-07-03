import { NextRequest, NextResponse } from "next/server";
import { ORCH_API_URL } from "../../../../lib/orch-api";

async function proxy(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const subpath = path.join("/");
  const url = new URL(
    `${ORCH_API_URL.replace(/\/$/, "")}/platform/v1/workforce/${subpath}`,
  );
  request.nextUrl.searchParams.forEach((v, k) => {
    url.searchParams.set(k, v);
  });

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  const orgId = request.headers.get("x-organization-id");
  if (orgId) headers.set("x-organization-id", orgId);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const res = await fetch(url.toString(), init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}
