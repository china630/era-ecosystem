import { NextRequest, NextResponse } from "next/server";
import { ORCH_API_URL } from "../../../../../../lib/orch-api";

const MDM_SERVICE_TOKEN =
  process.env.MDM_INTERNAL_SERVICE_TOKEN ??
  process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
  "";

async function proxy(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const subpath = path.join("/");
  const url = new URL(
    `${ORCH_API_URL.replace(/\/$/, "")}/internal/v1/mdm/persons/${subpath}`,
  );
  request.nextUrl.searchParams.forEach((v, k) => {
    url.searchParams.set(k, v);
  });

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  if (MDM_SERVICE_TOKEN) {
    headers.set("Authorization", `Bearer ${MDM_SERVICE_TOKEN}`);
    headers.set("x-service-token", MDM_SERVICE_TOKEN);
  }
  const orgId = request.headers.get("x-organization-id");
  if (orgId) headers.set("x-organization-id", orgId);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let bodyText: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    bodyText = await request.text();
    if (orgId && bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        if (!parsed.organizationId) {
          parsed.organizationId = orgId;
          bodyText = JSON.stringify(parsed);
        }
      } catch {
        /* pass through */
      }
    }
  }

  const init: RequestInit = { method: request.method, headers, body: bodyText };
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
