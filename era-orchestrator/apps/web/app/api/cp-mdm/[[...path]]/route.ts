import { NextRequest, NextResponse } from "next/server";
import { ORCH_API_URL } from "../../../../lib/orch-api";

const MDM_SERVICE_TOKEN =
  process.env.MDM_INTERNAL_SERVICE_TOKEN ??
  process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
  "";

/**
 * SEC-TOK-02: never inject the MDM service token for unauthenticated callers.
 * Browser must send Authorization (Orch JWT); we forward it and add x-service-token.
 */
async function proxy(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const callerAuth = request.headers.get("authorization")?.trim();
  if (!callerAuth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subpath = path.join("/");
  const url = new URL(
    `${ORCH_API_URL.replace(/\/$/, "")}/internal/v1/mdm/${subpath}`,
  );
  request.nextUrl.searchParams.forEach((v, k) => {
    url.searchParams.set(k, v);
  });

  const headers = new Headers();
  headers.set("Authorization", callerAuth);
  if (MDM_SERVICE_TOKEN) {
    headers.set("x-service-token", MDM_SERVICE_TOKEN);
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "MDM service token not configured" },
      { status: 503 },
    );
  }
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

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return proxy(request, path);
}
